package com.sportylive.app.data

import android.content.Context
import android.util.Base64
import com.sportylive.app.model.AppUser
import com.sportylive.app.model.Countries
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale
import java.util.UUID
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Device-local viewer accounts. The website uses a server-backed account store;
 * the native app keeps the same user-facing flow offline with hashed passwords
 * in SharedPreferences.
 */
class AccountRepository(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun currentUser(): AppUser? {
        val id = prefs.getString(KEY_SESSION, null) ?: return null
        val username = prefs.getString("acct_${id}_username", null)
        val countryCode = prefs.getString("acct_${id}_country", null)
        val createdAt = prefs.getLong("acct_${id}_created", 0L)
        if (username.isNullOrBlank() || countryCode.isNullOrBlank()) {
            prefs.edit().remove(KEY_SESSION).apply()
            return null
        }
        return toUser(id, username, countryCode, createdAt)
    }

    fun register(username: String, password: String, countryCode: String): Result<AppUser> {
        val name = username.trim()
        if (!USERNAME_RE.matches(name)) {
            return Result.failure(
                IllegalArgumentException(
                    "Username must be 3–24 characters (letters, numbers, dot, dash or underscore)."
                )
            )
        }
        if (password.length !in 8..128) {
            return Result.failure(
                IllegalArgumentException("Password must be between 8 and 128 characters.")
            )
        }
        val country = Countries.find(countryCode)
            ?: return Result.failure(IllegalArgumentException("Please choose a valid country."))

        val usernameLower = name.lowercase(Locale.US)
        if (prefs.getString("acct_name_$usernameLower", null) != null) {
            return Result.failure(IllegalArgumentException("That username is already taken."))
        }

        return runCatching {
            val id = "usr-" + UUID.randomUUID().toString().replace("-", "").take(16)
            val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
            val hash = hashPassword(password, salt)
            val createdAt = System.currentTimeMillis()
            prefs.edit()
                .putString("acct_name_$usernameLower", id)
                .putString("acct_${id}_username", name)
                .putString("acct_${id}_country", country.code)
                .putLong("acct_${id}_created", createdAt)
                .putString("acct_${id}_salt", Base64.encodeToString(salt, Base64.NO_WRAP))
                .putString("acct_${id}_hash", hash)
                .putString(KEY_SESSION, id)
                .apply()
            toUser(id, name, country.code, createdAt)
        }
    }

    fun login(username: String, password: String): Result<AppUser> {
        val usernameLower = username.trim().lowercase(Locale.US)
        val id = prefs.getString("acct_name_$usernameLower", null)
            ?: return invalidCredentials()
        val name = prefs.getString("acct_${id}_username", null)
            ?: return invalidCredentials()
        val countryCode = prefs.getString("acct_${id}_country", null)
            ?: return invalidCredentials()
        val salt = prefs.getString("acct_${id}_salt", null)?.let {
            runCatching { Base64.decode(it, Base64.NO_WRAP) }.getOrNull()
        } ?: return invalidCredentials()
        val expected = prefs.getString("acct_${id}_hash", null)
            ?: return invalidCredentials()
        val actual = hashPassword(password, salt)
        val matches = MessageDigest.isEqual(
            Base64.decode(expected, Base64.NO_WRAP),
            Base64.decode(actual, Base64.NO_WRAP),
        )
        if (!matches) return invalidCredentials()

        prefs.edit().putString(KEY_SESSION, id).apply()
        val createdAt = prefs.getLong("acct_${id}_created", System.currentTimeMillis())
        return Result.success(toUser(id, name, countryCode, createdAt))
    }

    fun logout() {
        prefs.edit().remove(KEY_SESSION).apply()
    }

    private fun invalidCredentials(): Result<AppUser> =
        Result.failure(IllegalArgumentException("Invalid username or password."))

    private fun toUser(
        id: String,
        username: String,
        countryCode: String,
        createdAt: Long,
    ): AppUser {
        val country = Countries.find(countryCode)
        return AppUser(
            id = id,
            username = username,
            countryCode = country?.code ?: countryCode,
            countryName = country?.name ?: countryCode,
            countryFlag = country?.flag ?: "🌍",
            createdAt = createdAt,
        )
    }

    private fun hashPassword(password: String, salt: ByteArray): String {
        val spec = PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH_BITS)
        return try {
            val key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1")
                .generateSecret(spec)
                .encoded
            Base64.encodeToString(key, Base64.NO_WRAP)
        } finally {
            spec.clearPassword()
        }
    }

    private companion object {
        const val PREFS_NAME = "sportylive_accounts"
        const val KEY_SESSION = "session_id"
        const val ITERATIONS = 12_000
        const val KEY_LENGTH_BITS = 256
        val USERNAME_RE = Regex("^[A-Za-z0-9._-]{3,24}$")
    }
}

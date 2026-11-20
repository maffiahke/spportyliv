package com.sportylive.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Group
import androidx.compose.material.icons.rounded.Login
import androidx.compose.material.icons.rounded.Logout
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sportylive.app.model.AppUser
import com.sportylive.app.model.Countries
import com.sportylive.app.model.UpcomingEvent
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.InkMuted
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.InkSecondary
import com.sportylive.app.ui.theme.SurfaceRaised
import com.sportylive.app.ui.theme.TelegramBlue
import com.sportylive.app.ui.theme.TelegramBlueLight
import com.sportylive.app.ui.theme.neuInset
import com.sportylive.app.ui.theme.neuSurface
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class AuthMode { SIGN_IN, SIGN_UP }

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(
    notifiedEvents: List<UpcomingEvent>,
    onRemoveReminder: (UpcomingEvent) -> Unit,
    user: AppUser?,
    onSignIn: (String, String) -> Result<AppUser>,
    onSignUp: (String, String, String) -> Result<AppUser>,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var defaultQuality by remember { mutableStateOf("4K") }
    var pushGoals by remember { mutableStateOf(true) }
    var favoriteSports by remember {
        mutableStateOf(setOf("Football", "Formula 1", "Basketball"))
    }

    var authMode by remember { mutableStateOf(AuthMode.SIGN_IN) }
    var authUsername by remember { mutableStateOf("") }
    var authPassword by remember { mutableStateOf("") }
    var authCountryCode by remember { mutableStateOf("") }
    var authError by remember { mutableStateOf<String?>(null) }
    var countryPickerOpen by remember { mutableStateOf(false) }
    val selectedCountry = Countries.find(authCountryCode)

    LaunchedEffect(user) {
        if (user != null) {
            authPassword = ""
            authError = null
        }
    }

    val openTelegramUrl: (String) -> Unit = { url ->
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        context.startActivity(intent)
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 1. Member / Guest Card
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .neuSurface(cornerRadius = 24.dp)
                    .padding(18.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .neuInset(cornerRadius = 50.dp)
                            .padding(5.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(CircleShape)
                                .background(
                                    if (user != null) {
                                        Brush.linearGradient(listOf(AccentBlue, Color(0xFF1E40AF)))
                                    } else {
                                        Brush.linearGradient(listOf(Color(0xFF94A3B8), Color(0xFF475569)))
                                    }
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (user != null) {
                                Text(
                                    text = user.username.take(1).uppercase(Locale.US),
                                    color = Color.White,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Rounded.Person,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        }
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = user?.username ?: "Guest User",
                            color = InkPrimary,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.ExtraBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = if (user != null) {
                                val since = SimpleDateFormat("MMM yyyy", Locale.US)
                                    .format(Date(user.createdAt))
                                "${user.countryFlag} ${user.countryName} · Member since $since"
                            } else {
                                "Sign in to save reminders and sync your preferences"
                            },
                            color = InkSecondary,
                            fontSize = 11.5.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }

                Column(horizontalAlignment = Alignment.End) {
                    Row(
                        modifier = Modifier
                            .neuInset(cornerRadius = 50.dp)
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            imageVector = if (user != null) Icons.Rounded.Shield else Icons.Rounded.Person,
                            contentDescription = null,
                            tint = if (user != null) AccentBlue else InkSecondary,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = if (user != null) "Active" else "Guest",
                            color = if (user != null) AccentBlue else InkSecondary,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    if (user != null) {
                        Row(
                            modifier = Modifier
                                .clickable { onSignOut() }
                                .padding(top = 6.dp, start = 4.dp, end = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Logout,
                                contentDescription = null,
                                tint = InkSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "Sign out",
                                color = InkSecondary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }

        // 1b. Account access for guests
        if (user == null) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .neuSurface(cornerRadius = 24.dp)
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .neuInset(cornerRadius = 50.dp)
                                .padding(4.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .background(Brush.linearGradient(listOf(AccentBlue, Color(0xFF1E40AF)))),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = if (authMode == AuthMode.SIGN_IN) Icons.Rounded.Login else Icons.Rounded.PersonAdd,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                        Column {
                            Text(
                                text = if (authMode == AuthMode.SIGN_IN) "Sign in to SportyLive" else "Create your account",
                                color = InkPrimary,
                                fontSize = 15.5.sp,
                                fontWeight = FontWeight.ExtraBold,
                            )
                            Text(
                                text = "Pick a username, password and your country",
                                color = InkSecondary,
                                fontSize = 11.5.sp,
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .neuInset(cornerRadius = 16.dp)
                            .padding(5.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        listOf(AuthMode.SIGN_IN to "Sign in", AuthMode.SIGN_UP to "Create account").forEach { (mode, label) ->
                            val selected = authMode == mode
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .then(
                                        if (selected) Modifier.neuSurface(
                                            cornerRadius = 12.dp,
                                            elevation = 3.dp,
                                            blurRadius = 8.dp
                                        ) else Modifier
                                    )
                                    .clickable {
                                        authMode = mode
                                        authError = null
                                    }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = label,
                                    color = if (selected) AccentBlue else InkSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = authUsername,
                        onValueChange = {
                            authUsername = it
                            authError = null
                        },
                        label = { Text("Username") },
                        placeholder = { Text("e.g. matchday_king") },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    OutlinedTextField(
                        value = authPassword,
                        onValueChange = {
                            authPassword = it
                            authError = null
                        },
                        label = { Text("Password") },
                        placeholder = {
                            Text(if (authMode == AuthMode.SIGN_UP) "At least 8 characters" else "Your password")
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (authMode == AuthMode.SIGN_UP) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .neuInset(cornerRadius = 16.dp)
                                .clickable { countryPickerOpen = true }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Public,
                                contentDescription = null,
                                tint = AccentBlue,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = selectedCountry?.let { "${it.flag} ${it.name}" } ?: "Select your country",
                                color = if (selectedCountry != null) InkPrimary else InkSecondary,
                                fontSize = 13.sp,
                                fontWeight = if (selectedCountry != null) FontWeight.SemiBold else FontWeight.Normal,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }

                    authError?.let { message ->
                        Text(
                            text = message,
                            color = Color(0xFFE11D48),
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }

                    Button(
                        onClick = {
                            authError = null
                            val result = if (authMode == AuthMode.SIGN_IN) {
                                onSignIn(authUsername, authPassword)
                            } else {
                                onSignUp(authUsername, authPassword, authCountryCode)
                            }
                            result.onFailure { error ->
                                authError = error.message ?: "Something went wrong. Please try again."
                            }
                        },
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AccentBlue,
                            contentColor = Color.White,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                    ) {
                        Icon(
                            imageVector = if (authMode == AuthMode.SIGN_IN) Icons.Rounded.Login else Icons.Rounded.PersonAdd,
                            contentDescription = null,
                            modifier = Modifier.size(17.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (authMode == AuthMode.SIGN_IN) "Sign in" else "Create account",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }

                    Text(
                        text = if (authMode == AuthMode.SIGN_IN) {
                            "New to SportyLive? Switch to Create account above."
                        } else {
                            "Your account keeps your reminders and preferences in sync."
                        },
                        color = InkMuted,
                        fontSize = 11.sp,
                    )
                }
            }
        }

        // 2. Join Us on Telegram (Channel & Group)
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .neuSurface(cornerRadius = 24.dp)
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .neuInset(cornerRadius = 50.dp)
                            .padding(4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(TelegramBlueLight, TelegramBlue))),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Send,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    Column {
                        Text(
                            text = "Join Us on Telegram",
                            color = InkPrimary,
                            fontSize = 15.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            text = "Get instant stream links, alerts & matchday chat",
                            color = InkSecondary,
                            fontSize = 11.5.sp,
                        )
                    }
                }

                TelegramActionRow(
                    title = "Telegram Channel",
                    subtitle = "Live links & match alerts",
                    icon = Icons.Rounded.Send,
                    onClick = { openTelegramUrl("https://t.me/sportylive_channel") },
                )

                TelegramActionRow(
                    title = "Telegram Group",
                    subtitle = "Fan chat & stream requests",
                    icon = Icons.Rounded.Group,
                    onClick = { openTelegramUrl("https://t.me/sportylive_group") },
                )
            }
        }

        // 3. Match Reminders
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .neuSurface(cornerRadius = 24.dp)
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Notifications,
                        contentDescription = null,
                        tint = AccentBlue,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = "Match Reminders (${notifiedEvents.size})",
                        color = InkPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                if (notifiedEvents.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .neuInset(cornerRadius = 16.dp)
                            .padding(14.dp),
                    ) {
                        Text(
                            text = "Tap the bell icon on any upcoming match to save kickoff alerts here.",
                            color = InkMuted,
                            fontSize = 12.sp,
                        )
                    }
                } else {
                    notifiedEvents.forEach { ev ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .neuInset(cornerRadius = 16.dp)
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${ev.homeTeam} vs ${ev.awayTeam}",
                                    color = InkPrimary,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    text = "${ev.dayOfWeek} ${ev.dayNumber} ${ev.month} · ${ev.time}",
                                    color = InkMuted,
                                    fontSize = 11.sp,
                                )
                            }
                            Text(
                                text = "Remove",
                                color = Color(0xFFE11D48),
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .neuSurface(cornerRadius = 50.dp, elevation = 2.dp, blurRadius = 6.dp)
                                    .clickable { onRemoveReminder(ev) }
                                    .padding(horizontal = 12.dp, vertical = 5.dp)
                            )
                        }
                    }
                }
            }
        }

        // 4. Stream Preferences
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .neuSurface(cornerRadius = 24.dp)
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Tv,
                        contentDescription = null,
                        tint = AccentBlue,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = "Stream Preferences",
                        color = InkPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Default Video Quality",
                        color = InkSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .neuInset(cornerRadius = 16.dp)
                            .padding(5.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        listOf("Auto", "4K", "HD").forEach { q ->
                            val selected = defaultQuality == q
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .then(
                                        if (selected) Modifier.neuSurface(cornerRadius = 12.dp, elevation = 3.dp, blurRadius = 8.dp)
                                        else Modifier
                                    )
                                    .clickable { defaultQuality = q }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    text = q,
                                    color = if (selected) AccentBlue else InkSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Goal & Kickoff Alerts",
                            color = InkPrimary,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "Instant score updates for saved matches",
                            color = InkMuted,
                            fontSize = 11.sp,
                        )
                    }
                    Switch(
                        checked = pushGoals,
                        onCheckedChange = { pushGoals = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = AccentBlue,
                        )
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Followed Sports",
                        color = InkSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        listOf("Football", "Basketball", "Tennis", "Boxing", "Formula 1").forEach { sport ->
                            val active = favoriteSports.contains(sport)
                            Row(
                                modifier = Modifier
                                    .then(
                                        if (active) Modifier.neuInset(cornerRadius = 50.dp)
                                        else Modifier.neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                                    )
                                    .clickable {
                                        favoriteSports = if (active) favoriteSports - sport else favoriteSports + sport
                                    }
                                    .padding(horizontal = 12.dp, vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                if (active) {
                                    Icon(
                                        imageVector = Icons.Rounded.Check,
                                        contentDescription = null,
                                        tint = AccentBlue,
                                        modifier = Modifier.size(13.dp)
                                    )
                                }
                                Text(
                                    text = sport,
                                    color = if (active) AccentBlue else InkSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (countryPickerOpen) {
        val sortedCountries = remember { Countries.all.sortedBy { it.name } }
        AlertDialog(
            onDismissRequest = { countryPickerOpen = false },
            containerColor = SurfaceRaised,
            title = {
                Text(
                    text = "Choose your country",
                    color = InkPrimary,
                    fontWeight = FontWeight.ExtraBold,
                )
            },
            text = {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 380.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(sortedCountries, key = { it.code }) { country ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    authCountryCode = country.code
                                    countryPickerOpen = false
                                }
                                .padding(horizontal = 8.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text(text = country.flag, fontSize = 18.sp)
                            Text(
                                text = country.name,
                                color = InkPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { countryPickerOpen = false }) {
                    Text("Cancel", color = InkSecondary, fontWeight = FontWeight.Bold)
                }
            },
        )
    }
}

@Composable
private fun TelegramActionRow(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .neuSurface(cornerRadius = 18.dp, elevation = 3.dp, blurRadius = 8.dp)
            .clickable { onClick() }
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .neuInset(cornerRadius = 50.dp)
                    .padding(4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(TelegramBlueLight, TelegramBlue))),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
            Column {
                Text(
                    text = title,
                    color = InkPrimary,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = subtitle,
                    color = InkSecondary,
                    fontSize = 11.sp,
                )
            }
        }

        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(TelegramBlue)
                .padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = "Join",
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
            Icon(
                imageVector = Icons.Rounded.OpenInNew,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(13.dp)
            )
        }
    }
}

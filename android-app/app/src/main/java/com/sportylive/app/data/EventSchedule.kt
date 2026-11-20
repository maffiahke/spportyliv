package com.sportylive.app.data

import androidx.compose.ui.graphics.Color
import com.sportylive.app.model.LiveMatch
import com.sportylive.app.model.SportCategoryId
import com.sportylive.app.model.UpcomingEvent
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Time-based split shared by Home and Fixtures:
 * - Upcoming: kickoff within the next 4 hours.
 * - Scheduled: everything later (typically 5+ hours away).
 */
object EventSchedule {
    const val UPCOMING_WINDOW_MS = 4L * 60 * 60 * 1000

    fun isUpcoming(event: UpcomingEvent, now: Long = System.currentTimeMillis()): Boolean {
        val remaining = event.kickoffEpochMs - now
        return remaining in 0..UPCOMING_WINDOW_MS
    }

    fun upcomingEvents(
        events: List<UpcomingEvent>,
        now: Long = System.currentTimeMillis(),
    ): List<UpcomingEvent> = events
        .filter { isUpcoming(it, now) }
        .sortedBy { it.kickoffEpochMs }

    fun scheduledEvents(
        events: List<UpcomingEvent>,
        now: Long = System.currentTimeMillis(),
    ): List<UpcomingEvent> = events
        .filterNot { isUpcoming(it, now) }
        .sortedBy { it.kickoffEpochMs }

    fun isToday(epochMs: Long, now: Long = System.currentTimeMillis()): Boolean {
        val a = Calendar.getInstance().apply { timeInMillis = epochMs }
        val b = Calendar.getInstance().apply { timeInMillis = now }
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR) &&
            a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)
    }

    fun isWithinDays(
        epochMs: Long,
        days: Int,
        now: Long = System.currentTimeMillis(),
    ): Boolean {
        val remaining = epochMs - now
        return remaining in 0..(days.toLong() * 24 * 60 * 60 * 1000)
    }

    /** Map a fixture onto the live arena card used for the Upcoming section. */
    fun toLiveMatch(event: UpcomingEvent): LiveMatch {
        val (left, right) = themesFor(event.sport)
        return LiveMatch(
            id = event.id,
            sport = event.sport,
            homeTeam = event.homeTeam,
            awayTeam = event.awayTeam,
            homeCrest = event.homeCrest,
            awayCrest = event.awayCrest,
            homeScore = 0,
            awayScore = 0,
            league = event.league,
            leagueCrest = event.leagueCrest,
            quality = "HD",
            viewers = "",
            leftTheme = left,
            rightTheme = right,
            venue = event.channel,
            sampleVideoRes = event.previewVideoRes,
            isUpcoming = true,
            kickoffEpochMs = event.kickoffEpochMs,
            eventId = event.id,
        )
    }

    fun countdownLabel(kickoffMs: Long, nowMs: Long = System.currentTimeMillis()): String {
        val remainingSeconds = (kickoffMs - nowMs) / 1000
        if (remainingSeconds <= 0) return "Kicking off now"
        val days = remainingSeconds / 86_400
        val hours = (remainingSeconds % 86_400) / 3_600
        val minutes = (remainingSeconds % 3_600) / 60
        val seconds = remainingSeconds % 60
        return when {
            days > 0 -> "Starts in ${days}d ${hours}h"
            hours > 0 -> "Starts in ${hours}h ${minutes}m"
            minutes > 0 -> "Starts in ${minutes}m ${seconds}s"
            else -> "Starts in ${seconds}s"
        }
    }

    fun kickoffLabel(kickoffMs: Long, nowMs: Long = System.currentTimeMillis()): String {
        val now = Calendar.getInstance().apply { timeInMillis = nowMs }
        val kickoff = Calendar.getInstance().apply { timeInMillis = kickoffMs }
        val startOfToday = Calendar.getInstance().apply {
            timeInMillis = nowMs
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val startOfKickoff = Calendar.getInstance().apply {
            timeInMillis = kickoffMs
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val dayDiff = ((startOfKickoff - startOfToday) / 86_400_000L).toInt()
        val dayLabel = when (dayDiff) {
            0 -> "Today"
            1 -> "Tomorrow"
            else -> SimpleDateFormat("EEE d MMM", Locale.US).format(Date(kickoffMs))
        }
        val time = SimpleDateFormat("HH:mm", Locale.US).format(Date(kickoff.timeInMillis))
        return "$dayLabel · $time"
    }

    fun dateKey(epochMs: Long): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(epochMs))

    private fun themesFor(sport: SportCategoryId): Pair<Color, Color> = when (sport) {
        SportCategoryId.FOOTBALL -> Color(0xFF0A369D) to Color(0xFF8E0E42)
        SportCategoryId.BASKETBALL -> Color(0xFF4C1D95) to Color(0xFF065F46)
        SportCategoryId.TENNIS -> Color(0xFF065F46) to Color(0xFF1E3A8A)
        SportCategoryId.BOXING -> Color(0xFF7F1D1D) to Color(0xFF1E293B)
        SportCategoryId.F1 -> Color(0xFF1E1B4B) to Color(0xFF991B1B)
        SportCategoryId.CRICKET -> Color(0xFF0369A1) to Color(0xFF134E4A)
        SportCategoryId.MMA -> Color(0xFF312E81) to Color(0xFF0F172A)
        SportCategoryId.GOLF -> Color(0xFF14532D) to Color(0xFF065F46)
        SportCategoryId.ALL -> Color(0xFF1E293B) to Color(0xFF334155)
    }
}

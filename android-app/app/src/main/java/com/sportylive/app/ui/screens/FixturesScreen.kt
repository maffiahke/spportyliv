package com.sportylive.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sportylive.app.data.EventSchedule
import com.sportylive.app.data.SportsRepository
import com.sportylive.app.model.LiveMatch
import com.sportylive.app.model.UpcomingEvent
import com.sportylive.app.ui.components.LiveMatchCard
import com.sportylive.app.ui.components.UpcomingEventCard
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.InkSecondary
import com.sportylive.app.ui.theme.neuSurface
import kotlinx.coroutines.delay

private enum class FixtureFilter(val label: String) {
    ALL("All"),
    TODAY("Today"),
    WEEK("This Week"),
    REMINDERS("Reminders"),
}

@Composable
fun FixturesScreen(
    notifiedIds: Set<String>,
    onToggleNotify: (UpcomingEvent) -> Unit,
    onWatchLive: (LiveMatch) -> Unit,
    onShareFeedback: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var filter by remember { mutableStateOf(FixtureFilter.ALL) }
    var scheduleNow by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            scheduleNow = System.currentTimeMillis()
        }
    }

    val allEvents = SportsRepository.upcomingEvents
    val upcoming = EventSchedule.upcomingEvents(allEvents, scheduleNow)
    val scheduled = EventSchedule.scheduledEvents(allEvents, scheduleNow)

    val matchesFilter: (UpcomingEvent) -> Boolean = { event ->
        when (filter) {
            FixtureFilter.ALL -> true
            FixtureFilter.TODAY -> EventSchedule.isToday(event.kickoffEpochMs, scheduleNow)
            FixtureFilter.WEEK -> EventSchedule.isWithinDays(event.kickoffEpochMs, 7, scheduleNow)
            FixtureFilter.REMINDERS -> notifiedIds.contains(event.id)
        }
    }

    val filteredUpcoming = upcoming.filter(matchesFilter)
    val filteredScheduled = scheduled.filter(matchesFilter)

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "Match Schedule",
                    color = InkPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = "Kickoff countdowns and scheduled fixtures. Tap the bell on any fixture to save a reminder.",
                    color = InkSecondary,
                    fontSize = 12.sp,
                )
            }
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(FixtureFilter.entries) { item ->
                    val active = filter == item
                    val label = if (item == FixtureFilter.REMINDERS) {
                        "Reminders (${notifiedIds.size})"
                    } else {
                        item.label
                    }
                    Box(
                        modifier = Modifier
                            .then(
                                if (active) {
                                    Modifier
                                        .clip(RoundedCornerShape(50))
                                        .background(AccentBlue)
                                } else {
                                    Modifier.neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                                }
                            )
                            .clickable { filter = item }
                            .padding(horizontal = 16.dp, vertical = 9.dp)
                    ) {
                        Text(
                            text = label,
                            color = if (active) Color.White else InkSecondary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }

        if (filteredUpcoming.isEmpty() && filteredScheduled.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .neuSurface(cornerRadius = 22.dp)
                        .padding(24.dp),
                ) {
                    Text(
                        text = "No fixtures match this filter yet.",
                        color = InkSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        } else {
            if (filteredUpcoming.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = "Upcoming",
                            color = InkPrimary,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            text = "Kickoff within 4 hours · live countdown",
                            color = InkSecondary,
                            fontSize = 11.sp,
                        )
                    }
                }
                items(filteredUpcoming, key = { it.id }) { event ->
                    val match = EventSchedule.toLiveMatch(event)
                    LiveMatchCard(
                        match = match,
                        onWatchLive = onWatchLive,
                        onShareFeedback = onShareFeedback,
                        isNotified = notifiedIds.contains(event.id),
                        onToggleNotify = { onToggleNotify(event) },
                    )
                }
            }

            if (filteredScheduled.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = "Scheduled",
                            color = InkPrimary,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            text = "5+ hours to kickoff",
                            color = InkSecondary,
                            fontSize = 11.sp,
                        )
                    }
                }
                items(filteredScheduled, key = { it.id }) { event ->
                    UpcomingEventCard(
                        event = event,
                        isNotified = notifiedIds.contains(event.id),
                        onToggleNotify = onToggleNotify,
                    )
                }
            }
        }
    }
}

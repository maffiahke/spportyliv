package com.sportylive.app.ui.screens

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sportylive.app.data.EventSchedule
import com.sportylive.app.data.SportsRepository
import com.sportylive.app.model.LiveMatch
import com.sportylive.app.model.SportCategoryId
import com.sportylive.app.model.UpcomingEvent
import com.sportylive.app.ui.components.HeroCarousel
import com.sportylive.app.ui.components.LiveMatchCard
import com.sportylive.app.ui.components.SportCategoryGlyph
import com.sportylive.app.ui.components.UpcomingEventCard
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.InkSecondary
import com.sportylive.app.ui.theme.LiveRed
import com.sportylive.app.ui.theme.neuInset
import com.sportylive.app.ui.theme.neuSurface
import kotlinx.coroutines.delay

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeScreen(
    selectedSport: SportCategoryId,
    searchQuery: String,
    notifiedIds: Set<String>,
    onSelectSport: (SportCategoryId) -> Unit,
    onWatchLive: (LiveMatch) -> Unit,
    onWatchMatchById: (String) -> Unit,
    onToggleNotify: (UpcomingEvent) -> Unit,
    onShareFeedback: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var showAllLive by remember { mutableStateOf(false) }
    var showAllScheduled by remember { mutableStateOf(false) }
    var moreSportsOpen by remember { mutableStateOf(false) }
    var scheduleNow by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            scheduleNow = System.currentTimeMillis()
        }
    }

    val query = searchQuery.trim().lowercase()

    val matchesQuery: (String, String, String) -> Boolean = { home, away, league ->
        query.isEmpty() ||
            home.lowercase().contains(query) ||
            away.lowercase().contains(query) ||
            league.lowercase().contains(query)
    }

    val filteredLive = remember(selectedSport, query) {
        SportsRepository.liveMatches.filter { match ->
            val sportOk = selectedSport == SportCategoryId.ALL || match.sport == selectedSport
            sportOk && matchesQuery(match.homeTeam, match.awayTeam, match.league)
        }
    }

    val upcomingMatches = remember(selectedSport, query, scheduleNow) {
        EventSchedule.upcomingEvents(SportsRepository.upcomingEvents, scheduleNow)
            .filter { ev ->
                val sportOk = selectedSport == SportCategoryId.ALL || ev.sport == selectedSport
                sportOk && matchesQuery(ev.homeTeam, ev.awayTeam, ev.league)
            }
            .map(EventSchedule::toLiveMatch)
    }

    val scheduledEvents = remember(selectedSport, query, scheduleNow) {
        EventSchedule.scheduledEvents(SportsRepository.upcomingEvents, scheduleNow)
            .filter { ev ->
                val sportOk = selectedSport == SportCategoryId.ALL || ev.sport == selectedSport
                sportOk && matchesQuery(ev.homeTeam, ev.awayTeam, ev.league)
            }
    }

    val visibleScheduled = if (showAllScheduled || query.isNotEmpty()) {
        scheduledEvents
    } else {
        scheduledEvents.take(2)
    }

    val toggleUpcomingReminder: (LiveMatch) -> Unit = { match ->
        val event = match.eventId?.let { id ->
            SportsRepository.upcomingEvents.firstOrNull { it.id == id }
        }
        if (event != null) onToggleNotify(event)
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 1. Sliding Hero Carousel
        item {
            HeroCarousel(
                slides = SportsRepository.heroSlides,
                onAction = onWatchMatchById
            )
        }

        // 2. 5-Column Category Grid (4 sports + More)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SportsRepository.primarySportCategories.forEach { sport ->
                        val active = selectedSport == sport
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .then(
                                    if (active) Modifier.neuInset(cornerRadius = 18.dp)
                                    else Modifier.neuSurface(cornerRadius = 18.dp, elevation = 4.dp, blurRadius = 10.dp)
                                )
                                .clickable {
                                    onSelectSport(if (active) SportCategoryId.ALL else sport)
                                    moreSportsOpen = false
                                }
                                .padding(vertical = 10.dp, horizontal = 4.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            SportCategoryGlyph(sport = sport, modifier = Modifier.size(32.dp))
                            Text(
                                text = sport.label,
                                color = if (active) AccentBlue else InkPrimary,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }

                    val extraSelected = SportsRepository.extraSportCategories.contains(selectedSport)
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .then(
                                if (moreSportsOpen || extraSelected) Modifier.neuInset(cornerRadius = 18.dp)
                                else Modifier.neuSurface(cornerRadius = 18.dp, elevation = 4.dp, blurRadius = 10.dp)
                            )
                            .clickable { moreSportsOpen = !moreSportsOpen }
                            .padding(vertical = 10.dp, horizontal = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        SportCategoryGlyph(
                            sport = SportCategoryId.ALL,
                            isMoreTile = true,
                            modifier = Modifier.size(32.dp)
                        )
                        Text(
                            text = "More",
                            color = if (extraSelected) AccentBlue else InkPrimary,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                        )
                    }
                }

                if (moreSportsOpen) {
                    FlowRow(
                        modifier = Modifier
                            .fillMaxWidth()
                            .neuSurface(cornerRadius = 20.dp)
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        SportsRepository.extraSportCategories.forEach { extra ->
                            val active = selectedSport == extra
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(if (active) AccentBlue else Color(0xFFE6EFFD))
                                    .clickable {
                                        onSelectSport(if (active) SportCategoryId.ALL else extra)
                                        moreSportsOpen = false
                                    }
                                    .padding(horizontal = 12.dp, vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                SportCategoryGlyph(sport = extra, modifier = Modifier.size(16.dp))
                                Text(
                                    text = extra.label,
                                    color = if (active) Color.White else InkPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }
            }
        }

        // 3. Live Now Section Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(13.dp)
                                .clip(CircleShape)
                                .background(LiveRed)
                        )
                    }
                    Text(
                        text = "Live Now",
                        color = InkPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }

                Row(
                    modifier = Modifier
                        .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                        .clickable { showAllLive = !showAllLive }
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = if (showAllLive) "Show Less" else "See All",
                        color = AccentBlue,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Icon(
                        imageVector = Icons.Rounded.ChevronRight,
                        contentDescription = null,
                        tint = AccentBlue,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        // 4. Live Now Cards (Horizontal by default, Vertical when See All clicked)
        if (filteredLive.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .neuSurface(cornerRadius = 24.dp)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No live broadcasts currently in this category",
                        color = InkSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        } else if (showAllLive || filteredLive.size == 1) {
            items(filteredLive, key = { it.id }) { match ->
                LiveMatchCard(
                    match = match,
                    onWatchLive = onWatchLive,
                    onShareFeedback = onShareFeedback,
                )
            }
        } else {
            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(vertical = 4.dp),
                ) {
                    items(filteredLive, key = { it.id }) { match ->
                        LiveMatchCard(
                            match = match,
                            onWatchLive = onWatchLive,
                            onShareFeedback = onShareFeedback,
                            modifier = Modifier.width(332.dp)
                        )
                    }
                }
            }
        }

        // 5. Upcoming Section Header (kickoff within 4 hours)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.CalendarMonth,
                            contentDescription = null,
                            tint = AccentBlue,
                            modifier = Modifier.size(17.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "Upcoming",
                            color = InkPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            text = "Kickoff within 4 hours",
                            color = InkSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }

                if (upcomingMatches.isNotEmpty()) {
                    Box(
                        modifier = Modifier
                            .neuInset(cornerRadius = 50.dp)
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "${upcomingMatches.size} soon",
                            color = AccentBlue,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }

        // 6. Upcoming Cards — live arena design with live countdown
        if (upcomingMatches.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .neuSurface(cornerRadius = 24.dp)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No matches kick off in the next 4 hours",
                        color = InkSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        } else {
            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(vertical = 4.dp),
                ) {
                    items(upcomingMatches, key = { it.id }) { match ->
                        LiveMatchCard(
                            match = match,
                            onWatchLive = onWatchLive,
                            onShareFeedback = onShareFeedback,
                            modifier = Modifier.width(332.dp),
                            isNotified = match.eventId?.let { notifiedIds.contains(it) } == true,
                            onToggleNotify = { toggleUpcomingReminder(match) },
                        )
                    }
                }
            }
        }

        // 7. Scheduled Section Header (5+ hours away)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.CalendarMonth,
                            contentDescription = null,
                            tint = AccentBlue,
                            modifier = Modifier.size(17.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "Scheduled",
                            color = InkPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            text = "5+ hours to kickoff",
                            color = InkSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                        .clickable { showAllScheduled = !showAllScheduled }
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = if (showAllScheduled) "Show Top" else "See All",
                        color = AccentBlue,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Icon(
                        imageVector = Icons.Rounded.ChevronRight,
                        contentDescription = null,
                        tint = AccentBlue,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        // 8. Scheduled List — compact fixture design
        if (visibleScheduled.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .neuSurface(cornerRadius = 22.dp)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No scheduled events match this filter",
                        color = InkSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        } else {
            items(visibleScheduled, key = { it.id }) { event ->
                UpcomingEventCard(
                    event = event,
                    isNotified = notifiedIds.contains(event.id),
                    onToggleNotify = onToggleNotify,
                )
            }
        }

        item { Spacer(modifier = Modifier.height(6.dp)) }
    }
}

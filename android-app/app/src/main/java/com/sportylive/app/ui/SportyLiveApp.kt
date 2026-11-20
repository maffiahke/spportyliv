package com.sportylive.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sportylive.app.data.AccountRepository
import com.sportylive.app.data.EventSchedule
import com.sportylive.app.data.SportsRepository
import com.sportylive.app.model.ActiveStreamState
import com.sportylive.app.model.AppUser
import com.sportylive.app.model.LiveMatch
import com.sportylive.app.model.NavTab
import com.sportylive.app.model.SportCategoryId
import com.sportylive.app.model.TVChannel
import com.sportylive.app.model.UpcomingEvent
import com.sportylive.app.ui.components.PipOverlay
import com.sportylive.app.ui.components.SportyLiveBrandMark
import com.sportylive.app.ui.screens.FixturesScreen
import com.sportylive.app.ui.screens.HomeScreen
import com.sportylive.app.ui.screens.LiveTVScreen
import com.sportylive.app.ui.screens.PlayerScreen
import com.sportylive.app.ui.screens.ProfileScreen
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.CanvasBlue
import com.sportylive.app.ui.theme.CanvasBlueBottom
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.InkSecondary
import com.sportylive.app.ui.theme.LiveRed
import com.sportylive.app.ui.theme.SurfaceRaised
import com.sportylive.app.ui.theme.neuInset
import com.sportylive.app.ui.theme.neuSurface
import kotlinx.coroutines.launch

@Composable
fun SportyLiveApp(
    isSystemPipMode: Boolean,
    onEnterSystemPip: () -> Unit,
) {
    var activeTab by remember { mutableStateOf(NavTab.HOME) }
    var selectedSport by remember { mutableStateOf(SportCategoryId.ALL) }
    var searchOpen by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var notificationsOpen by remember { mutableStateOf(false) }
    var notifications by remember { mutableStateOf(SportsRepository.initialNotifications) }
    var notifiedIds by remember { mutableStateOf(setOf<String>()) }

    var activeStream by remember { mutableStateOf<ActiveStreamState?>(null) }
    var playerIsPlaying by remember { mutableStateOf(true) }
    var playerMuted by remember { mutableStateOf(false) }
    var playerQuality by remember { mutableStateOf("1080p") }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val accountRepository = remember { AccountRepository(context.applicationContext) }
    var currentUser by remember { mutableStateOf<AppUser?>(accountRepository.currentUser()) }

    val showToast: (String) -> Unit = { msg ->
        scope.launch {
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(msg)
        }
    }

    val openPlayer: (LiveMatch, TVChannel?) -> Unit = { match, channel ->
        playerIsPlaying = true
        playerQuality = if ((channel?.quality ?: match.quality) == "4K") "4K" else "1080p"
        activeStream = ActiveStreamState(match = match, channel = channel, isPip = false)
    }

    val toggleNotify: (UpcomingEvent) -> Unit = { event ->
        val exists = notifiedIds.contains(event.id)
        notifiedIds = if (exists) notifiedIds - event.id else notifiedIds + event.id
        showToast(
            if (exists) "Removed reminder for ${event.homeTeam} vs ${event.awayTeam}"
            else "Reminder set for ${event.homeTeam} vs ${event.awayTeam}"
        )
    }

    val watchMatch: (LiveMatch) -> Unit = { match ->
        if (match.isUpcoming && match.sampleVideoRes == null && match.streamUrl == null) {
            val kickoff = match.kickoffEpochMs?.let { EventSchedule.kickoffLabel(it) } ?: "soon"
            showToast("${match.homeTeam} vs ${match.awayTeam} kicks off $kickoff")
        } else {
            openPlayer(match, null)
        }
    }

    val signIn: (String, String) -> Result<AppUser> = { username, password ->
        accountRepository.login(username, password).onSuccess { user ->
            currentUser = user
            showToast("Welcome back, ${user.username}!")
        }
    }

    val signUp: (String, String, String) -> Result<AppUser> = { username, password, countryCode ->
        accountRepository.register(username, password, countryCode).onSuccess { user ->
            currentUser = user
            showToast("Welcome to SportyLive, ${user.username}!")
        }
    }

    val signOut: () -> Unit = {
        accountRepository.logout()
        currentUser = null
        showToast("Signed out — browsing as a guest")
    }

    val unreadCount = notifications.count { it.unread }
    val isFullPlayerOpen = activeStream != null && activeStream?.isPip == false

    // In OS PiP mode, render full-bleed player only
    if (isSystemPipMode && activeStream != null) {
        val stream = activeStream!!
        PlayerScreen(
            match = stream.match,
            channel = stream.channel,
            isPlaying = playerIsPlaying,
            muted = playerMuted,
            quality = playerQuality,
            isSystemPipMode = true,
            onTogglePlay = { playerIsPlaying = !playerIsPlaying },
            onToggleMute = { playerMuted = !playerMuted },
            onChangeQuality = { playerQuality = it },
            onSelectStream = openPlayer,
            onEnterInAppPip = { activeStream = stream.copy(isPip = true) },
            onEnterSystemPip = onEnterSystemPip,
            onBack = { activeStream = null },
        )
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(CanvasBlue, CanvasBlueBottom)))
    ) {
        Scaffold(
            containerColor = Color.Transparent,
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            topBar = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CanvasBlue.copy(alpha = 0.94f))
                        .statusBarsPadding()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    activeStream = activeStream?.copy(isPip = true)
                                    activeTab = NavTab.HOME
                                    selectedSport = SportCategoryId.ALL
                                    searchQuery = ""
                                },
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            SportyLiveBrandMark(modifier = Modifier.size(36.dp))
                            Column {
                                Text(
                                    text = buildAnnotatedString {
                                        withStyle(SpanStyle(color = InkPrimary)) {
                                            append("Sporty")
                                        }
                                        withStyle(
                                            SpanStyle(
                                                color = AccentBlue,
                                                fontStyle = FontStyle.Italic
                                            )
                                        ) {
                                            append("Live")
                                        }
                                    },
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    maxLines = 1,
                                )
                                Text(
                                    text = "LIVE SPORTS STREAMING AND CHANNELS",
                                    color = InkSecondary,
                                    fontSize = 8.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            IconButton(
                                onClick = { searchOpen = !searchOpen },
                                modifier = Modifier
                                    .size(40.dp)
                                    .then(
                                        if (searchOpen) Modifier.neuInset(cornerRadius = 50.dp)
                                        else Modifier.neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                                    )
                            ) {
                                Icon(
                                    imageVector = if (searchOpen) Icons.Rounded.Close else Icons.Rounded.Search,
                                    contentDescription = "Search",
                                    tint = if (searchOpen) AccentBlue else InkPrimary,
                                    modifier = Modifier.size(19.dp)
                                )
                            }

                            Box {
                                IconButton(
                                    onClick = { notificationsOpen = true },
                                    modifier = Modifier
                                        .size(40.dp)
                                        .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Notifications,
                                        contentDescription = "Notifications",
                                        tint = InkPrimary,
                                        modifier = Modifier.size(19.dp)
                                    )
                                }
                                if (unreadCount > 0) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .size(18.dp)
                                            .clip(CircleShape)
                                            .background(LiveRed),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            text = unreadCount.toString(),
                                            color = Color.White,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (searchOpen) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = {
                                searchQuery = it
                                activeStream = activeStream?.copy(isPip = true)
                                if (activeTab != NavTab.HOME) activeTab = NavTab.HOME
                            },
                            placeholder = {
                                Text(
                                    text = "Search teams, leagues, or sports...",
                                    fontSize = 13.sp,
                                )
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(50),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            },
            bottomBar = {
                // Docked (non-floating) mobile bottom navigation bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceRaised.copy(alpha = 0.96f))
                        .border(width = 1.dp, color = Color.White.copy(alpha = 0.85f))
                        .navigationBarsPadding()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    val navItems = listOf(
                        NavTab.HOME to Icons.Rounded.Home,
                        NavTab.LIVE_TV to Icons.Rounded.Tv,
                        NavTab.FIXTURES to Icons.Rounded.EmojiEvents,
                        NavTab.PROFILE to Icons.Rounded.Person,
                    )
                    navItems.forEach { (tab, icon) ->
                        val active = !isFullPlayerOpen && activeTab == tab
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .then(
                                    if (active) Modifier.neuInset(cornerRadius = 16.dp)
                                    else Modifier
                                )
                                .clickable {
                                    activeStream = activeStream?.copy(isPip = true)
                                    activeTab = tab
                                }
                                .padding(vertical = 7.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(
                                imageVector = icon,
                                contentDescription = tab.label,
                                tint = if (active) AccentBlue else InkSecondary,
                                modifier = Modifier.size(19.dp)
                            )
                            Text(
                                text = tab.label,
                                color = if (active) AccentBlue else InkSecondary,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                if (isFullPlayerOpen && activeStream != null) {
                    val stream = activeStream!!
                    PlayerScreen(
                        match = stream.match,
                        channel = stream.channel,
                        isPlaying = playerIsPlaying,
                        muted = playerMuted,
                        quality = playerQuality,
                        isSystemPipMode = false,
                        onTogglePlay = { playerIsPlaying = !playerIsPlaying },
                        onToggleMute = { playerMuted = !playerMuted },
                        onChangeQuality = { playerQuality = it },
                        onSelectStream = openPlayer,
                        onEnterInAppPip = { activeStream = stream.copy(isPip = true) },
                        onEnterSystemPip = onEnterSystemPip,
                        onBack = { activeStream = null },
                    )
                } else {
                    when (activeTab) {
                        NavTab.HOME -> HomeScreen(
                            selectedSport = selectedSport,
                            searchQuery = searchQuery,
                            notifiedIds = notifiedIds,
                            onSelectSport = { selectedSport = it },
                            onWatchLive = watchMatch,
                            onWatchMatchById = { id ->
                                val match = SportsRepository.liveMatches.find { it.id == id }
                                    ?: SportsRepository.liveMatches.first()
                                openPlayer(match, null)
                            },
                            onToggleNotify = toggleNotify,
                            onShareFeedback = showToast,
                        )

                        NavTab.LIVE_TV -> LiveTVScreen(
                            onWatchChannel = { match, ch -> openPlayer(match, ch) }
                        )

                        NavTab.FIXTURES -> FixturesScreen(
                            notifiedIds = notifiedIds,
                            onToggleNotify = toggleNotify,
                            onWatchLive = watchMatch,
                            onShareFeedback = showToast,
                        )

                        NavTab.PROFILE -> ProfileScreen(
                            notifiedEvents = SportsRepository.upcomingEvents.filter {
                                notifiedIds.contains(it.id)
                            },
                            onRemoveReminder = toggleNotify,
                            user = currentUser,
                            onSignIn = signIn,
                            onSignUp = signUp,
                            onSignOut = signOut,
                        )
                    }
                }
            }
        }

        // In-App Floating Draggable Picture-in-Picture Player
        if (activeStream?.isPip == true) {
            val stream = activeStream!!
            PipOverlay(
                match = stream.match,
                channel = stream.channel,
                isPlaying = playerIsPlaying,
                muted = playerMuted,
                onTogglePlay = { playerIsPlaying = !playerIsPlaying },
                onToggleMute = { playerMuted = !playerMuted },
                onExpand = { activeStream = stream.copy(isPip = false) },
                onClose = { activeStream = null },
            )
        }

        // Live Alerts Dialog
        if (notificationsOpen) {
            AlertDialog(
                onDismissRequest = { notificationsOpen = false },
                containerColor = SurfaceRaised,
                title = {
                    Text(
                        text = "Live Alerts",
                        fontWeight = FontWeight.ExtraBold,
                        color = InkPrimary,
                    )
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        notifications.forEach { item ->
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .neuInset(cornerRadius = 14.dp)
                                    .clickable {
                                        notifications = notifications.map {
                                            if (it.id == item.id) it.copy(unread = false) else it
                                        }
                                        notificationsOpen = false
                                        item.matchId?.let { id ->
                                            val m = SportsRepository.liveMatches.find { it.id == id }
                                            if (m != null) openPlayer(m, null)
                                        }
                                    }
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = item.title,
                                    color = InkPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    text = item.detail,
                                    color = InkSecondary,
                                    fontSize = 11.5.sp,
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            notifications = notifications.map { it.copy(unread = false) }
                            notificationsOpen = false
                        }
                    ) {
                        Text("Mark all read", color = AccentBlue, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { notificationsOpen = false }) {
                        Text("Close", color = InkSecondary)
                    }
                },
            )
        }
    }
}

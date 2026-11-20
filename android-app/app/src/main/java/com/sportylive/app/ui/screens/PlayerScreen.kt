package com.sportylive.app.ui.screens

import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PictureInPictureAlt
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.sportylive.app.data.SportsRepository
import com.sportylive.app.model.LiveMatch
import com.sportylive.app.model.TVChannel
import com.sportylive.app.ui.components.ChannelEmblemDisc
import com.sportylive.app.ui.components.TeamCrestBadge
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.InkMuted
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.InkSecondary
import com.sportylive.app.ui.theme.LiveRed
import com.sportylive.app.ui.theme.LiveRedDark
import com.sportylive.app.ui.theme.neuInset
import com.sportylive.app.ui.theme.neuSurface
import kotlinx.coroutines.delay

private sealed interface RelatedItem {
    data class MatchItem(val match: LiveMatch) : RelatedItem
    data class ChannelItem(val channel: TVChannel, val match: LiveMatch) : RelatedItem
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun PlayerScreen(
    match: LiveMatch,
    channel: TVChannel?,
    isPlaying: Boolean,
    muted: Boolean,
    quality: String,
    isSystemPipMode: Boolean,
    onTogglePlay: () -> Unit,
    onToggleMute: () -> Unit,
    onChangeQuality: (String) -> Unit,
    onSelectStream: (LiveMatch, TVChannel?) -> Unit,
    onEnterInAppPip: () -> Unit,
    onEnterSystemPip: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val title = channel?.name ?: "${match.homeTeam} vs ${match.awayTeam}"
    val subtitle = channel?.currentShow ?: match.league
    val currentSport = channel?.sport ?: match.sport

    val videoUri: Uri? = remember(match.id, match.sampleVideoRes, match.streamUrl) {
        when {
            match.sampleVideoRes != null ->
                Uri.parse("android.resource://${context.packageName}/${match.sampleVideoRes}")
            !match.streamUrl.isNullOrBlank() ->
                Uri.parse(match.streamUrl)
            else -> null
        }
    }

    val exoPlayer = remember(videoUri) {
        if (videoUri == null) null
        else ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(videoUri))
            repeatMode = Player.REPEAT_MODE_ALL
            playWhenReady = isPlaying
            volume = if (muted) 0f else 1f
            prepare()
        }
    }

    DisposableEffect(exoPlayer) {
        onDispose {
            exoPlayer?.release()
        }
    }

    LaunchedEffect(exoPlayer, isPlaying) {
        exoPlayer?.let { if (isPlaying) it.play() else it.pause() }
    }

    LaunchedEffect(exoPlayer, muted) {
        exoPlayer?.volume = if (muted) 0f else 1f
    }

    var currentMs by remember(exoPlayer) { mutableLongStateOf(0L) }
    var durationMs by remember(exoPlayer) { mutableLongStateOf(0L) }

    LaunchedEffect(exoPlayer, isPlaying) {
        while (exoPlayer != null) {
            currentMs = exoPlayer.currentPosition.coerceAtLeast(0L)
            durationMs = exoPlayer.duration.coerceAtLeast(0L)
            delay(250)
        }
    }

    // In Android OS Picture-in-Picture mode, render only the clean video viewport
    if (isSystemPipMode) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF091326)),
        ) {
            if (exoPlayer != null) {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            useController = false
                            resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                            player = exoPlayer
                        }
                    },
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Brush.linearGradient(listOf(match.leftTheme, Color(0xFF091326), match.rightTheme))),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        return
    }

    val relatedItems = remember(match.id, channel?.id, currentSport) {
        if (channel != null) {
            val sameSportChannels = SportsRepository.tvChannels.filter {
                it.id != channel.id && it.sport == currentSport
            }
            val otherChannels = SportsRepository.tvChannels.filter {
                it.id != channel.id && it.sport != currentSport
            }
            val pickedChannels = (sameSportChannels + otherChannels).take(4).map { ch ->
                val linked = SportsRepository.liveMatches.find { it.id == ch.linkedMatchId }
                    ?: SportsRepository.liveMatches.first()
                RelatedItem.ChannelItem(ch, linked)
            }
            val otherMatches = SportsRepository.liveMatches
                .filter { it.id != match.id }
                .take(2)
                .map { RelatedItem.MatchItem(it) }
            pickedChannels + otherMatches
        } else {
            val sameSportChannels = SportsRepository.tvChannels
                .filter { it.sport == currentSport }
                .take(2)
                .map { ch ->
                    val linked = SportsRepository.liveMatches.find { it.id == ch.linkedMatchId } ?: match
                    RelatedItem.ChannelItem(ch, linked)
                }
            val otherMatches = SportsRepository.liveMatches
                .filter { it.id != match.id }
                .sortedBy { if (it.sport == currentSport) 0 else 1 }
                .map { RelatedItem.MatchItem(it) }
            (sameSportChannels + otherMatches).take(6)
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 1. Clean Match Title & Back Header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .neuSurface(cornerRadius = 22.dp)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .size(40.dp)
                        .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                        contentDescription = "Go back",
                        tint = InkPrimary,
                    )
                }

                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .neuInset(cornerRadius = 50.dp)
                        .padding(6.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    TeamCrestBadge(crest = match.leagueCrest, size = 28.dp)
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        color = InkPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = subtitle,
                        color = InkSecondary,
                        fontSize = 11.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                IconButton(
                    onClick = onEnterInAppPip,
                    modifier = Modifier
                        .size(38.dp)
                        .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PictureInPictureAlt,
                        contentDescription = "Minimize to PiP",
                        tint = InkPrimary,
                        modifier = Modifier.size(18.dp),
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(LiveRed)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "LIVE",
                        color = Color.White,
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
            }
        }

        // 2. Clean 16:9 Neumorphic Player View
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .neuSurface(cornerRadius = 26.dp)
                    .padding(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color(0xFF091326))
                        .clickable { onTogglePlay() }
                ) {
                    if (exoPlayer != null) {
                        AndroidView(
                            factory = { ctx ->
                                PlayerView(ctx).apply {
                                    useController = false
                                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                    layoutParams = FrameLayout.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                    player = exoPlayer
                                }
                            },
                            update = { view ->
                                if (view.player !== exoPlayer) {
                                    view.player = exoPlayer
                                }
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.linearGradient(
                                        listOf(match.leftTheme, Color(0xFF091326), match.rightTheme)
                                    )
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(18.dp),
                            ) {
                                TeamCrestBadge(crest = match.homeCrest, size = 56.dp)
                                Text(
                                    text = "VS",
                                    color = Color.White,
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Black,
                                    fontStyle = FontStyle.Italic,
                                )
                                TeamCrestBadge(crest = match.awayCrest, size = 56.dp)
                            }
                        }
                    }

                    if (!isPlaying) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(AccentBlue)
                                .clickable { onTogglePlay() },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = "Play stream",
                                tint = Color.White,
                                modifier = Modifier.size(30.dp)
                            )
                        }
                    }

                    // Bottom Player Controls Bar
                    Column(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .padding(10.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xA6020617))
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    ) {
                        if (exoPlayer != null && durationMs > 0L) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Slider(
                                    value = currentMs.toFloat().coerceIn(0f, durationMs.toFloat()),
                                    onValueChange = { pos ->
                                        currentMs = pos.toLong()
                                        exoPlayer.seekTo(currentMs)
                                    },
                                    valueRange = 0f..durationMs.toFloat(),
                                    colors = SliderDefaults.colors(
                                        thumbColor = LiveRed,
                                        activeTrackColor = LiveRed,
                                        inactiveTrackColor = Color.White.copy(alpha = 0.28f),
                                    ),
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(22.dp),
                                )
                                Text(
                                    text = "${formatMs(currentMs)} / ${formatMs(durationMs)}",
                                    color = Color.White.copy(alpha = 0.9f),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = onTogglePlay,
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                                        contentDescription = if (isPlaying) "Pause" else "Play",
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                IconButton(
                                    onClick = onToggleMute,
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = if (muted) Icons.AutoMirrored.Rounded.VolumeOff else Icons.AutoMirrored.Rounded.VolumeUp,
                                        contentDescription = if (muted) "Unmute" else "Mute",
                                        tint = Color.White,
                                        modifier = Modifier.size(19.dp)
                                    )
                                }
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Row(
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .background(Color.White.copy(alpha = 0.14f))
                                        .padding(2.dp),
                                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                                ) {
                                    listOf("4K", "1080p", "720p").forEach { q ->
                                        val selected = quality == q
                                        Box(
                                            modifier = Modifier
                                                .clip(CircleShape)
                                                .background(if (selected) AccentBlue else Color.Transparent)
                                                .clickable { onChangeQuality(q) }
                                                .padding(horizontal = 8.dp, vertical = 3.dp)
                                        ) {
                                            Text(
                                                text = q,
                                                color = Color.White,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                            )
                                        }
                                    }
                                }

                                IconButton(
                                    onClick = onEnterSystemPip,
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Fullscreen,
                                        contentDescription = "System Picture-in-Picture",
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Similar & Related Section Below Player
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
                            imageVector = Icons.Rounded.Tv,
                            contentDescription = null,
                            tint = AccentBlue,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    Text(
                        text = "Similar & Related",
                        color = InkPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }

                Text(
                    text = "${relatedItems.size} live",
                    color = InkMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        items(relatedItems) { item ->
            when (item) {
                is RelatedItem.MatchItem -> {
                    val m = item.match
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .neuSurface(cornerRadius = 20.dp)
                            .clickable { onSelectStream(m, null) }
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .width(96.dp)
                                .height(64.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(
                                    Brush.linearGradient(
                                        listOf(m.leftTheme, Color(0xFF1D4ED8), Color(0xFFE11D48), m.rightTheme)
                                    )
                                )
                                .padding(6.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopStart)
                                    .clip(CircleShape)
                                    .background(LiveRed)
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "LIVE",
                                    color = Color.White,
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                )
                            }
                            Row(
                                modifier = Modifier
                                    .align(Alignment.Center)
                                    .padding(top = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp),
                            ) {
                                TeamCrestBadge(crest = m.homeCrest, size = 24.dp)
                                Text(
                                    text = "VS",
                                    color = Color.White,
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.Black,
                                    fontStyle = FontStyle.Italic,
                                )
                                TeamCrestBadge(crest = m.awayCrest, size = 24.dp)
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "${m.homeTeam} vs ${m.awayTeam}",
                                color = InkPrimary,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp),
                            ) {
                                TeamCrestBadge(crest = m.leagueCrest, size = 14.dp)
                                Text(
                                    text = "${m.league} · ${m.viewers}",
                                    color = InkSecondary,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }

                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Brush.horizontalGradient(listOf(LiveRed, LiveRedDark))),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = "Watch",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                is RelatedItem.ChannelItem -> {
                    val ch = item.channel
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .neuSurface(cornerRadius = 20.dp)
                            .clickable { onSelectStream(item.match, ch) }
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .neuInset(cornerRadius = 14.dp)
                                .padding(6.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            ChannelEmblemDisc(variant = ch.logoVariant)
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = ch.name,
                                color = InkPrimary,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = ch.currentShow,
                                color = InkSecondary,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = "LIVE · ${ch.quality} · ${ch.viewers}",
                                color = InkMuted,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(Brush.horizontalGradient(listOf(LiveRed, LiveRedDark))),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = "Watch channel",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }
        }

        item { Spacer(modifier = Modifier.height(6.dp)) }
    }
}

private fun formatMs(ms: Long): String {
    val totalSeconds = (ms / 1000L).coerceAtLeast(0L)
    val mins = totalSeconds / 60L
    val secs = totalSeconds % 60L
    return "$mins:${secs.toString().padStart(2, '0')}"
}

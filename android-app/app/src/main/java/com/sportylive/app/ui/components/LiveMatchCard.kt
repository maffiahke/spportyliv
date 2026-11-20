package com.sportylive.app.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccessTime
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.sportylive.app.data.EventSchedule
import com.sportylive.app.model.LiveMatch
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.LiveRed
import com.sportylive.app.ui.theme.LiveRedDark
import com.sportylive.app.ui.theme.neuInset
import com.sportylive.app.ui.theme.neuSurface
import kotlinx.coroutines.delay

@Composable
fun LiveMatchCard(
    match: LiveMatch,
    onWatchLive: (LiveMatch) -> Unit,
    onShareFeedback: (String) -> Unit,
    modifier: Modifier = Modifier,
    isNotified: Boolean = false,
    onToggleNotify: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val isUpcoming = match.isUpcoming
    val isPlayable = match.sampleVideoRes != null || match.streamUrl != null
    var nowMs by remember(match.id) { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(match.id, isUpcoming, match.kickoffEpochMs) {
        if (isUpcoming && match.kickoffEpochMs != null) {
            while (true) {
                nowMs = System.currentTimeMillis()
                delay(1_000)
            }
        }
    }

    val countdown = match.kickoffEpochMs?.let { EventSchedule.countdownLabel(it, nowMs) }

    Column(
        modifier = modifier
            .neuSurface(cornerRadius = 24.dp)
            .padding(10.dp)
    ) {
        // Arena Visual Banner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(162.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            match.leftTheme,
                            Color(0xFF1D4ED8),
                            Color(0xFFE11D48),
                            match.rightTheme,
                        )
                    )
                )
                .clickable { onWatchLive(match) }
                .padding(12.dp)
        ) {
            // Top Row: LIVE + Viewers on Left, Native Share Button on Right
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (isUpcoming) AccentBlue else LiveRed)
                            .padding(horizontal = 10.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = if (isUpcoming) "UPCOMING" else "LIVE",
                            color = Color.White,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }

                    Row(
                        modifier = Modifier
                            .weight(1f, fill = false)
                            .clip(CircleShape)
                            .background(Color(0x99020617))
                            .padding(horizontal = 10.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                    ) {
                        Icon(
                            imageVector = if (isUpcoming) Icons.Rounded.AccessTime else Icons.Rounded.Visibility,
                            contentDescription = null,
                            tint = Color(0xFFE2E8F0),
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = if (isUpcoming) countdown ?: "Kickoff soon" else match.viewers,
                            color = Color.White,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }

                    if (isUpcoming && onToggleNotify != null) {
                        IconButton(
                            onClick = onToggleNotify,
                            modifier = Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(if (isNotified) AccentBlue else Color(0x8C020617))
                        ) {
                            Icon(
                                imageVector = if (isNotified) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsNone,
                                contentDescription = if (isNotified) "Remove reminder" else "Set reminder",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                IconButton(
                    onClick = {
                        shareMatchNative(context, match, isUpcoming)
                        onShareFeedback("Sharing ${match.homeTeam} vs ${match.awayTeam}")
                    },
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(Color(0x8C020617))
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Share,
                        contentDescription = "Share ${match.homeTeam} vs ${match.awayTeam}",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // Center Teams & VS
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.Center)
                    .padding(top = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    TeamCrestBadge(crest = match.homeCrest, size = 56.dp)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = match.homeTeam,
                        color = Color.White,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                Text(
                    text = "VS",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    fontStyle = FontStyle.Italic,
                    modifier = Modifier.padding(horizontal = 6.dp)
                )

                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    TeamCrestBadge(crest = match.awayCrest, size = 56.dp)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = match.awayTeam,
                        color = Color.White,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Bottom Strip: Full Visible League Pill + Red Watch Live Button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .neuInset(cornerRadius = 50.dp)
                    .padding(horizontal = 12.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TeamCrestBadge(crest = match.leagueCrest, size = 20.dp)
                Text(
                    text = match.league,
                    color = InkPrimary,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Button(
                onClick = { onWatchLive(match) },
                shape = RoundedCornerShape(50),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isUpcoming) AccentBlue else LiveRed,
                    contentColor = Color.White,
                ),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 9.dp),
                modifier = Modifier
                    .height(40.dp)
                    .background(
                        Brush.horizontalGradient(
                            if (isUpcoming) listOf(AccentBlue, Color(0xFF1E40AF))
                            else listOf(LiveRed, LiveRedDark)
                        ),
                        RoundedCornerShape(50)
                    )
            ) {
                Icon(
                    imageVector = if (isUpcoming) Icons.Rounded.AccessTime else Icons.Rounded.PlayArrow,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (isUpcoming) {
                        if (isPlayable) "Preview" else "Kickoff Info"
                    } else {
                        "Watch Live"
                    },
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
            }
        }
    }
}

private fun shareMatchNative(context: Context, match: LiveMatch, isUpcoming: Boolean) {
    val shareUrl = "https://sportylive.app/?match=${match.id}"
    val shareText = if (isUpcoming) {
        val kickoff = match.kickoffEpochMs?.let { EventSchedule.kickoffLabel(it) } ?: "soon"
        "Don't miss ${match.homeTeam} vs ${match.awayTeam} (${match.league}) — $kickoff on SportyLive! $shareUrl"
    } else {
        "Watch ${match.homeTeam} vs ${match.awayTeam} (${match.league}) live now on SportyLive! $shareUrl"
    }

    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    clipboard?.setPrimaryClip(ClipData.newPlainText("SportyLive Match", shareUrl))

    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(
            Intent.EXTRA_SUBJECT,
            "${match.homeTeam} vs ${match.awayTeam} — ${if (isUpcoming) "Upcoming" else "Live"} on SportyLive"
        )
        putExtra(Intent.EXTRA_TEXT, shareText)
    }
    context.startActivity(Intent.createChooser(sendIntent, "Share Match"))
}

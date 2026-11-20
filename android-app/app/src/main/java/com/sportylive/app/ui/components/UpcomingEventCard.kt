package com.sportylive.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sportylive.app.model.UpcomingEvent
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.InkMuted
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.InkSecondary
import com.sportylive.app.ui.theme.neuInset
import com.sportylive.app.ui.theme.neuSurface

@Composable
fun UpcomingEventCard(
    event: UpcomingEvent,
    isNotified: Boolean,
    onToggleNotify: (UpcomingEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .neuSurface(cornerRadius = 22.dp)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Recessed Date Box
        Column(
            modifier = Modifier
                .width(54.dp)
                .neuInset(cornerRadius = 16.dp)
                .padding(vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = event.dayOfWeek,
                color = InkMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = event.dayNumber,
                color = InkPrimary,
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = event.month,
                color = InkMuted,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        // Single-line Team Logos & Metadata
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                TeamCrestBadge(crest = event.homeCrest, size = 20.dp)
                Text(
                    text = event.homeTeam,
                    color = InkPrimary,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = "vs",
                    color = AccentBlue,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = event.awayTeam,
                    color = InkPrimary,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                TeamCrestBadge(crest = event.awayCrest, size = 20.dp)
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    imageVector = Icons.Rounded.Schedule,
                    contentDescription = null,
                    tint = InkMuted,
                    modifier = Modifier.size(13.dp)
                )
                Text(
                    text = event.time,
                    color = InkSecondary,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(text = "|", color = InkMuted, fontSize = 11.sp)
                TeamCrestBadge(crest = event.leagueCrest, size = 14.dp)
                Text(
                    text = event.league,
                    color = InkSecondary,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Compact Circular Bell Reminder Button
        IconButton(
            onClick = { onToggleNotify(event) },
            modifier = Modifier
                .size(44.dp)
                .then(
                    if (isNotified) {
                        Modifier
                            .clip(CircleShape)
                            .background(AccentBlue)
                    } else {
                        Modifier.neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                    }
                )
        ) {
            Icon(
                imageVector = if (isNotified) Icons.Rounded.NotificationsActive else Icons.Outlined.Notifications,
                contentDescription = if (isNotified) "Remove reminder" else "Set reminder",
                tint = if (isNotified) Color.White else AccentBlue,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

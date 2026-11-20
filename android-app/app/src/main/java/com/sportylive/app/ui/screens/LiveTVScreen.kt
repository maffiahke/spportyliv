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
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.sportylive.app.data.SportsRepository
import com.sportylive.app.model.LiveMatch
import com.sportylive.app.model.SportCategoryId
import com.sportylive.app.model.TVChannel
import com.sportylive.app.ui.components.ChannelEmblemDisc
import com.sportylive.app.ui.theme.AccentBlue
import com.sportylive.app.ui.theme.InkMuted
import com.sportylive.app.ui.theme.InkPrimary
import com.sportylive.app.ui.theme.InkSecondary
import com.sportylive.app.ui.theme.LiveRed
import com.sportylive.app.ui.theme.neuInset
import com.sportylive.app.ui.theme.neuSurface

@Composable
fun LiveTVScreen(
    onWatchChannel: (LiveMatch, TVChannel) -> Unit,
    modifier: Modifier = Modifier,
) {
    var sportFilter by remember { mutableStateOf(SportCategoryId.ALL) }
    var expandedFeatured by remember { mutableStateOf(false) }
    var expandedRecent by remember { mutableStateOf(false) }

    val filterTabs = listOf(
        SportCategoryId.ALL to "All Channels",
        SportCategoryId.CRICKET to "Cricket",
        SportCategoryId.FOOTBALL to "Football",
        SportCategoryId.BASKETBALL to "Basketball",
        SportCategoryId.BOXING to "Boxing",
        SportCategoryId.F1 to "F1",
        SportCategoryId.TENNIS to "Tennis",
    )

    val filtered = remember(sportFilter) {
        if (sportFilter == SportCategoryId.ALL) {
            SportsRepository.tvChannels
        } else {
            SportsRepository.tvChannels.filter { it.sport == sportFilter }
        }
    }

    val featuredChannels = filtered.filter { it.shelf == "featured" }
    val recentChannels = filtered.filter { it.shelf == "recent" }

    val tuneIn: (TVChannel) -> Unit = { channel ->
        val match = SportsRepository.liveMatches.find { it.id == channel.linkedMatchId }
            ?: SportsRepository.liveMatches.first()
        onWatchChannel(match, channel)
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        // Sport Filter Strip
        item {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                items(filterTabs) { (id, label) ->
                    val active = sportFilter == id
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
                            .clickable { sportFilter = id }
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

        if (featuredChannels.isNotEmpty()) {
            item {
                ChannelShelfSection(
                    title = "Featured Channels",
                    channels = featuredChannels,
                    expanded = expandedFeatured,
                    onToggleExpand = { expandedFeatured = !expandedFeatured },
                    onSelectChannel = tuneIn,
                )
            }
        }

        if (recentChannels.isNotEmpty()) {
            item {
                ChannelShelfSection(
                    title = "Recently Added Channels",
                    channels = recentChannels,
                    expanded = expandedRecent,
                    onToggleExpand = { expandedRecent = !expandedRecent },
                    onSelectChannel = tuneIn,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChannelShelfSection(
    title: String,
    channels: List<TVChannel>,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onSelectChannel: (TVChannel) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = title,
                color = InkPrimary,
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold,
            )

            Row(
                modifier = Modifier
                    .neuSurface(cornerRadius = 50.dp, elevation = 3.dp, blurRadius = 8.dp)
                    .clickable { onToggleExpand() }
                    .padding(horizontal = 14.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = if (expanded) "Show Less" else "View All",
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

        if (expanded) {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                maxItemsInEachRow = 2,
            ) {
                channels.forEach { channel ->
                    ChannelTile(
                        channel = channel,
                        onClick = { onSelectChannel(channel) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        } else {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                items(channels, key = { it.id }) { channel ->
                    ChannelTile(
                        channel = channel,
                        onClick = { onSelectChannel(channel) },
                        modifier = Modifier.width(142.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ChannelTile(
    channel: TVChannel,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .neuSurface(cornerRadius = 22.dp)
            .clickable { onClick() }
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .neuInset(cornerRadius = 50.dp)
                .padding(6.dp),
            contentAlignment = Alignment.Center,
        ) {
            ChannelEmblemDisc(variant = channel.logoVariant)
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = channel.name,
            color = InkPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(LiveRed)
            )
            Text(
                text = channel.quality,
                color = InkMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

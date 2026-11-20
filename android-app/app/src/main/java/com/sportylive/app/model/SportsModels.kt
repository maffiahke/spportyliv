package com.sportylive.app.model

import androidx.annotation.RawRes
import androidx.compose.ui.graphics.Color

enum class SportCategoryId(val label: String) {
    ALL("All"),
    FOOTBALL("Football"),
    BASKETBALL("Basketball"),
    TENNIS("Tennis"),
    BOXING("Boxing"),
    F1("F1"),
    CRICKET("Cricket"),
    MMA("MMA"),
    GOLF("Golf"),
}

enum class NavTab(val label: String) {
    HOME("Home"),
    LIVE_TV("Live TV"),
    FIXTURES("Fixtures"),
    PROFILE("Profile"),
}

enum class CrestId {
    REAL_MADRID,
    BARCELONA,
    MAN_UTD,
    CHELSEA,
    ARSENAL,
    TOTTENHAM,
    LALIGA,
    PREMIER_LEAGUE,
    LAKERS,
    CELTICS,
    NBA,
    ALCARAZ,
    SINNER,
    ATP,
    FURY,
    USYK,
    BOXING_BELT,
    F1_REDBULL,
    F1_FERRARI,
    F1_LEAGUE,
    BAYERN,
    DORTMUND,
    BUNDESLIGA,
}

enum class ChannelLogoVariant {
    WILLOW,
    WILLOW_XTRA,
    TNT,
    SKY_PL,
    BEIN,
    STAR_1,
    STAR_HINDI,
    PTV,
    NBA,
    F1,
}

data class LiveMatch(
    val id: String,
    val sport: SportCategoryId,
    val homeTeam: String,
    val awayTeam: String,
    val homeCrest: CrestId,
    val awayCrest: CrestId,
    val homeScore: Int,
    val awayScore: Int,
    val league: String,
    val leagueCrest: CrestId,
    val quality: String,
    val viewers: String,
    val leftTheme: Color,
    val rightTheme: Color,
    val venue: String,
    @RawRes val sampleVideoRes: Int? = null,
    val streamUrl: String? = null,
    /** True when this card represents a fixture kicking off within 4 hours. */
    val isUpcoming: Boolean = false,
    /** Kickoff timestamp used by the upcoming countdown. */
    val kickoffEpochMs: Long? = null,
    /** Source fixture id, used to toggle its reminder. */
    val eventId: String? = null,
)

data class UpcomingEvent(
    val id: String,
    val sport: SportCategoryId,
    val dayOfWeek: String,
    val dayNumber: String,
    val month: String,
    val dateKey: String,
    val homeTeam: String,
    val awayTeam: String,
    val homeCrest: CrestId,
    val awayCrest: CrestId,
    val time: String,
    val league: String,
    val leagueCrest: CrestId,
    val channel: String,
    val kickoffEpochMs: Long,
    @RawRes val previewVideoRes: Int? = null,
)

data class TVChannel(
    val id: String,
    val name: String,
    val shortCode: String,
    val sport: SportCategoryId,
    val shelf: String, // "featured" | "recent"
    val logoVariant: ChannelLogoVariant,
    val currentShow: String,
    val nextShow: String,
    val quality: String,
    val viewers: String,
    val linkedMatchId: String,
)

data class HeroSlide(
    val id: String,
    val headlineTop: String,
    val headlineHighlight: String,
    val headlineBottom: String,
    val subtitleLine1: String,
    val subtitleLine2: String,
    val ctaLabel: String,
    val matchId: String,
    val startColor: Color,
    val midColor: Color,
    val endColor: Color,
)

data class NotificationItem(
    val id: String,
    val title: String,
    val detail: String,
    val timeAgo: String,
    val unread: Boolean,
    val matchId: String? = null,
)

data class ActiveStreamState(
    val match: LiveMatch,
    val channel: TVChannel? = null,
    val isPip: Boolean = false,
)

data class AppUser(
    val id: String,
    val username: String,
    val countryCode: String,
    val countryName: String,
    val countryFlag: String,
    val createdAt: Long,
)

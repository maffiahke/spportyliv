package com.sportylive.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DirectionsCar
import androidx.compose.material.icons.rounded.GolfCourse
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.SportsBaseball
import androidx.compose.material.icons.rounded.SportsBasketball
import androidx.compose.material.icons.rounded.SportsCricket
import androidx.compose.material.icons.rounded.SportsMma
import androidx.compose.material.icons.rounded.SportsSoccer
import androidx.compose.material.icons.rounded.SportsTennis
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sportylive.app.model.ChannelLogoVariant
import com.sportylive.app.model.CrestId
import com.sportylive.app.model.SportCategoryId

@Composable
fun SportyLiveBrandMark(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val playPath = Path().apply {
            moveTo(w * 0.22f, h * 0.14f)
            lineTo(w * 0.88f, h * 0.50f)
            lineTo(w * 0.22f, h * 0.86f)
            close()
        }
        drawPath(
            path = playPath,
            brush = Brush.linearGradient(
                colors = listOf(Color(0xFF1D6BFF), Color(0xFF00C2FF), Color(0xFFFF6B35)),
                start = Offset.Zero,
                end = Offset(w, h)
            )
        )
        val innerPath = Path().apply {
            moveTo(w * 0.34f, h * 0.30f)
            lineTo(w * 0.68f, h * 0.50f)
            lineTo(w * 0.34f, h * 0.70f)
            close()
        }
        drawPath(path = innerPath, color = Color.White.copy(alpha = 0.85f))
    }
}

@Composable
fun SportCategoryGlyph(
    sport: SportCategoryId,
    isMoreTile: Boolean = false,
    modifier: Modifier = Modifier,
) {
    if (isMoreTile) {
        Box(
            modifier = modifier
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(Color(0xFF2563EB), Color(0xFF60A5FA)))),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Rounded.GridView,
                contentDescription = "More sports",
                tint = Color.White,
                modifier = Modifier.fillMaxSize(0.58f)
            )
        }
        return
    }

    val (icon, bgColors) = when (sport) {
        SportCategoryId.FOOTBALL -> Icons.Rounded.SportsSoccer to listOf(Color(0xFF1E293B), Color(0xFF0F172A))
        SportCategoryId.BASKETBALL -> Icons.Rounded.SportsBasketball to listOf(Color(0xFFF97316), Color(0xFFC2410C))
        SportCategoryId.TENNIS -> Icons.Rounded.SportsTennis to listOf(Color(0xFF84CC16), Color(0xFF4D7C0F))
        SportCategoryId.BOXING -> Icons.Rounded.SportsMma to listOf(Color(0xFFEF4444), Color(0xFFB91C1C))
        SportCategoryId.F1 -> Icons.Rounded.DirectionsCar to listOf(Color(0xFFDC2626), Color(0xFF7F1D1D))
        SportCategoryId.CRICKET -> Icons.Rounded.SportsCricket to listOf(Color(0xFF0284C7), Color(0xFF1E3A8A))
        SportCategoryId.MMA -> Icons.Rounded.SportsMma to listOf(Color(0xFF475569), Color(0xFF0F172A))
        SportCategoryId.GOLF -> Icons.Rounded.GolfCourse to listOf(Color(0xFF10B981), Color(0xFF047857))
        SportCategoryId.ALL -> Icons.Rounded.SportsBaseball to listOf(Color(0xFF1D6BFF), Color(0xFF1E40AF))
    }

    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(Brush.linearGradient(bgColors)),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = sport.label,
            tint = Color.White,
            modifier = Modifier.fillMaxSize(0.62f)
        )
    }
}

@Composable
fun TeamCrestBadge(
    crest: CrestId,
    size: Dp = 44.dp,
    modifier: Modifier = Modifier,
) {
    val (bg, accent, label) = when (crest) {
        CrestId.REAL_MADRID -> Triple(Color(0xFFFFFFFF), Color(0xFFD4AF37), "MCF")
        CrestId.BARCELONA -> Triple(Color(0xFFA50044), Color(0xFF004D98), "FCB")
        CrestId.MAN_UTD -> Triple(Color(0xFFDA291C), Color(0xFFFBE122), "MUFC")
        CrestId.CHELSEA -> Triple(Color(0xFF034694), Color(0xFFFFFFFF), "CFC")
        CrestId.ARSENAL -> Triple(Color(0xFFEF0107), Color(0xFFD4AF37), "ARS")
        CrestId.TOTTENHAM -> Triple(Color(0xFF132257), Color(0xFFFFFFFF), "THFC")
        CrestId.LALIGA -> Triple(Color(0xFFFF4B44), Color(0xFFFFFFFF), "LL")
        CrestId.PREMIER_LEAGUE -> Triple(Color(0xFF38003C), Color(0xFF00FF85), "PL")
        CrestId.LAKERS -> Triple(Color(0xFF552583), Color(0xFFFDB927), "LAL")
        CrestId.CELTICS -> Triple(Color(0xFF007A33), Color(0xFFBA9653), "BOS")
        CrestId.NBA -> Triple(Color(0xFF1D428A), Color(0xFFC8102E), "NBA")
        CrestId.ALCARAZ -> Triple(Color(0xFFC60B1E), Color(0xFFFFC400), "CA")
        CrestId.SINNER -> Triple(Color(0xFF008C45), Color(0xFFCD212A), "JS")
        CrestId.ATP -> Triple(Color(0xFF0B2559), Color(0xFF38BDF8), "ATP")
        CrestId.FURY -> Triple(Color(0xFF991B1B), Color(0xFFFACC15), "TF")
        CrestId.USYK -> Triple(Color(0xFF0057B7), Color(0xFFFFDD00), "OU")
        CrestId.BOXING_BELT -> Triple(Color(0xFF92400E), Color(0xFFFDE047), "WBC")
        CrestId.F1_REDBULL -> Triple(Color(0xFF1E1B4B), Color(0xFFFACC15), "RBR")
        CrestId.F1_FERRARI -> Triple(Color(0xFFDC0000), Color(0xFFFFF200), "SF")
        CrestId.F1_LEAGUE -> Triple(Color(0xFFE10600), Color(0xFFFFFFFF), "F1")
        CrestId.BAYERN -> Triple(Color(0xFFDC052D), Color(0xFF0066B2), "FCB")
        CrestId.DORTMUND -> Triple(Color(0xFFFDE100), Color(0xFF111827), "BVB")
        CrestId.BUNDESLIGA -> Triple(Color(0xFFD20515), Color(0xFFFFFFFF), "BL")
    }

    val textColor = if (bg == Color.White || bg == Color(0xFFFDE100)) Color(0xFF0F172A) else Color.White
    val fontSize = (size.value * 0.25f).coerceIn(8f, 14f).sp

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(bg)
            .border(width = (size.value * 0.08f).dp.coerceAtLeast(1.5.dp), color = accent, shape = CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = fontSize,
            fontWeight = FontWeight.ExtraBold,
            maxLines = 1,
        )
    }
}

@Composable
fun ChannelEmblemDisc(
    variant: ChannelLogoVariant,
    modifier: Modifier = Modifier,
) {
    val (bg, fg, label) = when (variant) {
        ChannelLogoVariant.WILLOW -> Triple(Color.White, Color(0xFF0F172A), "WILLOW")
        ChannelLogoVariant.WILLOW_XTRA -> Triple(Color.White, Color(0xFFB91C1C), "XTRA")
        ChannelLogoVariant.TNT -> Triple(Color(0xFF5B21B6), Color(0xFFF472B6), "TNT")
        ChannelLogoVariant.SKY_PL -> Triple(Color(0xFF1D4ED8), Color(0xFFFFFFFF), "SKY PL")
        ChannelLogoVariant.BEIN -> Triple(Color(0xFF5B21B6), Color(0xFFFFFFFF), "beIN")
        ChannelLogoVariant.STAR_1 -> Triple(Color(0xFF1E3A8A), Color(0xFF38BDF8), "STAR 1")
        ChannelLogoVariant.STAR_HINDI -> Triple(Color(0xFF0369A1), Color(0xFFFFFFFF), "STAR हि")
        ChannelLogoVariant.PTV -> Triple(Color(0xFF15803D), Color(0xFFFFFFFF), "PTV")
        ChannelLogoVariant.NBA -> Triple(Color(0xFF1D428A), Color(0xFFFFFFFF), "NBA")
        ChannelLogoVariant.F1 -> Triple(Color(0xFFDC2626), Color(0xFFFFFFFF), "F1 4K")
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .clip(CircleShape)
            .background(bg)
            .padding(4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.ExtraBold,
            maxLines = 1,
        )
    }
}

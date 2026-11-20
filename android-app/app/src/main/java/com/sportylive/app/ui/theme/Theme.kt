package com.sportylive.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val SportyColorScheme = lightColorScheme(
    primary = AccentBlue,
    onPrimary = NeuShadowLight,
    secondary = LiveRed,
    onSecondary = NeuShadowLight,
    background = CanvasBlue,
    onBackground = InkPrimary,
    surface = SurfaceRaised,
    onSurface = InkPrimary,
    surfaceVariant = SurfaceInset,
    onSurfaceVariant = InkSecondary,
)

private val SportyTypography = Typography(
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 20.sp,
        letterSpacing = (-0.4).sp,
        color = InkPrimary
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 15.sp,
        color = InkPrimary
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        color = InkSecondary
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
        color = InkPrimary
    )
)

@Composable
fun SportyLiveTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SportyColorScheme,
        typography = SportyTypography,
        content = content
    )
}

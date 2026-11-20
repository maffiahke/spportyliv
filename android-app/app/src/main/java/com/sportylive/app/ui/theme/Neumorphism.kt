package com.sportylive.app.ui.theme

import android.graphics.BlurMaskFilter
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Raised light-neumorphic surface matching the CSS `.neu-surface` and `.neu-surface-sm` tokens.
 */
fun Modifier.neuSurface(
    cornerRadius: Dp = 24.dp,
    elevation: Dp = 6.dp,
    blurRadius: Dp = 14.dp,
    backgroundColor: Color = SurfaceRaised,
    borderColor: Color = Color.White.copy(alpha = 0.85f),
): Modifier = this
    .drawBehind {
        val cornerPx = cornerRadius.toPx()
        val offsetPx = elevation.toPx()
        val blurPx = blurRadius.toPx().coerceAtLeast(1f)

        drawIntoCanvas { canvas ->
            val lightPaint = Paint().apply {
                asFrameworkPaint().apply {
                    isAntiAlias = true
                    color = NeuShadowLight.copy(alpha = 0.92f).toArgb()
                    maskFilter = BlurMaskFilter(blurPx, BlurMaskFilter.Blur.NORMAL)
                }
            }
            canvas.drawRoundRect(
                left = -offsetPx * 0.5f,
                top = -offsetPx * 0.5f,
                right = size.width - offsetPx * 0.5f,
                bottom = size.height - offsetPx * 0.5f,
                radiusX = cornerPx,
                radiusY = cornerPx,
                paint = lightPaint
            )

            val darkPaint = Paint().apply {
                asFrameworkPaint().apply {
                    isAntiAlias = true
                    color = NeuShadowDark.copy(alpha = 0.50f).toArgb()
                    maskFilter = BlurMaskFilter(blurPx, BlurMaskFilter.Blur.NORMAL)
                }
            }
            canvas.drawRoundRect(
                left = offsetPx,
                top = offsetPx,
                right = size.width + offsetPx,
                bottom = size.height + offsetPx,
                radiusX = cornerPx,
                radiusY = cornerPx,
                paint = darkPaint
            )
        }
    }
    .clip(RoundedCornerShape(cornerRadius))
    .background(backgroundColor, RoundedCornerShape(cornerRadius))
    .border(1.dp, borderColor, RoundedCornerShape(cornerRadius))

/**
 * Recessed light-neumorphic well matching `.neu-inset` and `.neu-inset-sm`.
 */
fun Modifier.neuInset(
    cornerRadius: Dp = 20.dp,
    backgroundColor: Color = SurfaceInset,
): Modifier = this
    .clip(RoundedCornerShape(cornerRadius))
    .background(backgroundColor, RoundedCornerShape(cornerRadius))
    .drawWithContent {
        drawContent()
        val cornerPx = cornerRadius.toPx()
        drawRoundRect(
            color = NeuShadowDark.copy(alpha = 0.28f),
            cornerRadius = CornerRadius(cornerPx, cornerPx),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx())
        )
    }
    .border(1.dp, Color.White.copy(alpha = 0.72f), RoundedCornerShape(cornerRadius))

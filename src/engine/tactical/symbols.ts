import { Affiliation, Echelon, MilitaryUnit, ThemeMode, UnitStatus, UnitType } from '../../types';

/**
 * C-MIL-01 & C-MIL-02: MIL-STD-2525 / APP-6 Vector Military Symbology Renderer
 * Supports Friend/Hostile/Neutral/Unknown frames, military branches, echelons, and status decorators.
 */
export class MilitarySymbolRenderer {
  /**
   * Colors according to affiliation and theme
   */
  public static getAffiliationColors(affiliation: Affiliation, theme: ThemeMode) {
    const isDark = theme === 'dark';

    switch (affiliation) {
      case 'friend':
        return {
          fill: isDark ? 'rgba(20, 60, 110, 0.85)' : 'rgba(215, 235, 255, 0.95)',
          stroke: isDark ? '#4DA8FF' : '#005FB8',
          icon: isDark ? '#E6F1FA' : '#003366',
          halo: isDark ? 'rgba(77, 168, 255, 0.4)' : 'rgba(0, 95, 184, 0.3)',
        };
      case 'hostile':
        return {
          fill: isDark ? 'rgba(110, 20, 30, 0.85)' : 'rgba(255, 220, 225, 0.95)',
          stroke: isDark ? '#FF4D5E' : '#C71D2D',
          icon: isDark ? '#FFFFFF' : '#800A15',
          halo: isDark ? 'rgba(255, 77, 94, 0.4)' : 'rgba(199, 29, 45, 0.3)',
        };
      case 'neutral':
        return {
          fill: isDark ? 'rgba(20, 90, 60, 0.85)' : 'rgba(215, 250, 235, 0.95)',
          stroke: isDark ? '#3DDC97' : '#00875A',
          icon: isDark ? '#E6F1FA' : '#004D34',
          halo: isDark ? 'rgba(61, 220, 151, 0.4)' : 'rgba(0, 135, 90, 0.3)',
        };
      case 'unknown':
      default:
        return {
          fill: isDark ? 'rgba(110, 90, 20, 0.85)' : 'rgba(255, 245, 215, 0.95)',
          stroke: isDark ? '#FFD84D' : '#C48200',
          icon: isDark ? '#FFFFFF' : '#614000',
          halo: isDark ? 'rgba(255, 216, 77, 0.4)' : 'rgba(196, 130, 0, 0.3)',
        };
    }
  }

  /**
   * Renders a unit on canvas at its screen position
   */
  public static renderUnit(
    ctx: CanvasRenderingContext2D,
    unit: MilitaryUnit,
    screenX: number,
    screenY: number,
    theme: ThemeMode,
    zoom: number
  ): void {
    ctx.save();
    ctx.translate(screenX, screenY);

    // LOD scaling: 28px medium, up to 38px close
    const baseSize = zoom >= 1.5 ? 36 : zoom <= 0.6 ? 24 : 30;
    const half = baseSize / 2;
    const colors = this.getAffiliationColors(unit.affiliation, theme);

    // If unit destroyed
    if (unit.status === 'destroyed') {
      ctx.globalAlpha = 0.55;
    }

    // Selection highlight glow & brackets
    if (unit.selected) {
      ctx.save();
      ctx.strokeStyle = theme === 'dark' ? '#3FD0FF' : '#0284C7';
      ctx.lineWidth = 2;
      const bPad = half + 7;
      const bLen = 6;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(-bPad, -bPad + bLen);
      ctx.lineTo(-bPad, -bPad);
      ctx.lineTo(-bPad + bLen, -bPad);
      // Top-Right
      ctx.moveTo(bPad - bLen, -bPad);
      ctx.lineTo(bPad, -bPad);
      ctx.lineTo(bPad, -bPad + bLen);
      // Bottom-Right
      ctx.moveTo(bPad, bPad - bLen);
      ctx.lineTo(bPad, bPad);
      ctx.lineTo(bPad - bLen, bPad);
      // Bottom-Left
      ctx.moveTo(-bPad + bLen, bPad);
      ctx.lineTo(-bPad, bPad);
      ctx.lineTo(-bPad, bPad - bLen);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Affiliation Frame
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2.2;
    ctx.beginPath();

    switch (unit.affiliation) {
      case 'friend':
        // Standard rectangle (aspect ratio approx 1.25)
        ctx.rect(-half * 1.15, -half * 0.85, baseSize * 1.15, baseSize * 0.85);
        break;
      case 'hostile':
        // Diamond
        ctx.moveTo(0, -half * 1.2);
        ctx.lineTo(half * 1.2, 0);
        ctx.lineTo(0, half * 1.2);
        ctx.lineTo(-half * 1.2, 0);
        ctx.closePath();
        break;
      case 'neutral':
        // Square
        ctx.rect(-half, -half, baseSize, baseSize);
        break;
      case 'unknown':
      default: {
        // Clover / Quatrefoil arch
        const r = half * 0.9;
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        break;
      }
    }
    ctx.fill();
    ctx.stroke();

    // Draw Unit Branch Icon
    ctx.strokeStyle = colors.icon;
    ctx.fillStyle = colors.icon;
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const iconW = half * 0.75;
    const iconH = half * 0.55;

    switch (unit.unitType) {
      case 'infantry':
        // Crossed diagonals (Saltire)
        ctx.beginPath();
        ctx.moveTo(-iconW, -iconH);
        ctx.lineTo(iconW, iconH);
        ctx.moveTo(iconW, -iconH);
        ctx.lineTo(-iconW, iconH);
        ctx.stroke();
        break;

      case 'armor':
        // Oval track
        ctx.beginPath();
        ctx.ellipse(0, 0, iconW * 0.95, iconH * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'mech':
        // Track + Saltire
        ctx.beginPath();
        ctx.ellipse(0, 0, iconW * 0.95, iconH * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-iconW * 0.6, -iconH * 0.45);
        ctx.lineTo(iconW * 0.6, iconH * 0.45);
        ctx.moveTo(iconW * 0.6, -iconH * 0.45);
        ctx.lineTo(-iconW * 0.6, iconH * 0.45);
        ctx.stroke();
        break;

      case 'artillery':
        // Solid center circle
        ctx.beginPath();
        ctx.arc(0, 0, iconW * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'airdefense':
        // Dome arch
        ctx.beginPath();
        ctx.arc(0, iconH * 0.3, iconW * 0.75, Math.PI, 0, false);
        ctx.stroke();
        break;

      case 'recon':
        // Single diagonal slash
        ctx.beginPath();
        ctx.moveTo(-iconW, iconH);
        ctx.lineTo(iconW, -iconH);
        ctx.stroke();
        break;

      case 'aviation':
        // Dual horizontal propeller / rotor loops
        ctx.beginPath();
        ctx.ellipse(-iconW * 0.5, 0, iconW * 0.45, iconH * 0.35, 0, 0, Math.PI * 2);
        ctx.ellipse(iconW * 0.5, 0, iconW * 0.45, iconH * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'hq':
        // Headquarters staff with command pennant
        ctx.beginPath();
        ctx.moveTo(-iconW * 0.6, iconH);
        ctx.lineTo(-iconW * 0.6, -iconH);
        ctx.lineTo(iconW * 0.6, -iconH * 0.4);
        ctx.lineTo(-iconW * 0.6, 0);
        ctx.stroke();
        break;
    }

    // Draw Echelon Symbol at Top of Frame
    this.renderEchelon(ctx, unit.echelon, half, colors.icon);

    // Heading / Velocity Vector
    if (unit.heading !== undefined && unit.speed && unit.speed > 0) {
      const rad = ((unit.heading - 90) * Math.PI) / 180.0;
      const vLen = Math.min(45, half + unit.speed * 0.6);
      ctx.save();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rad) * vLen, Math.sin(rad) * vLen);
      ctx.stroke();
      ctx.restore();
    }

    // Status bar & Decorators
    const barW = baseSize * 0.9;
    const barH = 3;
    const barY = half * 0.9 + 3;

    // Readiness bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-barW / 2, barY, barW, barH);
    let readyColor = '#3DDC97'; // green
    if (unit.readiness < 0.4) readyColor = '#FF4D5E';
    else if (unit.readiness < 0.75) readyColor = '#FFB547';
    ctx.fillStyle = readyColor;
    ctx.fillRect(-barW / 2, barY, barW * Math.max(0, Math.min(1, unit.readiness)), barH);

    // Damaged slash or Destroyed X
    if (unit.status === 'damaged') {
      ctx.strokeStyle = '#FFB547';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(half * 0.4, half * 0.1);
      ctx.lineTo(half * 0.9, half * 0.8);
      ctx.stroke();
    } else if (unit.status === 'destroyed') {
      ctx.strokeStyle = '#FF4D5E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-half, -half);
      ctx.lineTo(half, half);
      ctx.moveTo(half, -half);
      ctx.lineTo(-half, half);
      ctx.stroke();
    }

    // Name & Designation Label
    if (zoom >= 0.7) {
      ctx.font = 'bold 10px "JetBrains Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = barY + barH + 3;

      // Label background box
      const text = unit.name || unit.designation || 'UNIT';
      const tm = ctx.measureText(text);
      ctx.fillStyle = theme === 'dark' ? 'rgba(10, 16, 24, 0.85)' : 'rgba(255, 255, 255, 0.88)';
      ctx.fillRect(-tm.width / 2 - 3, labelY, tm.width + 6, 13);

      ctx.fillStyle = theme === 'dark' ? '#E6F1FA' : '#0F172A';
      ctx.fillText(text, 0, labelY + 1);
    }

    ctx.restore();
  }

  private static renderEchelon(
    ctx: CanvasRenderingContext2D,
    echelon: Echelon,
    half: number,
    color: string
  ): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.font = 'bold 9px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const y = -half * 0.9 - 2;

    switch (echelon) {
      case 'team':
        ctx.fillText('Ø', 0, y);
        break;
      case 'squad':
        ctx.beginPath();
        ctx.arc(0, y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'platoon':
        ctx.beginPath();
        ctx.arc(-3, y - 2, 1.8, 0, Math.PI * 2);
        ctx.arc(3, y - 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'company':
        ctx.fillText('I', 0, y);
        break;
      case 'battalion':
        ctx.fillText('II', 0, y);
        break;
      case 'regiment':
        ctx.fillText('III', 0, y);
        break;
      case 'brigade':
        ctx.fillText('X', 0, y);
        break;
      case 'division':
        ctx.fillText('XX', 0, y);
        break;
    }
    ctx.restore();
  }
}

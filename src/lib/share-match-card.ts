export interface MatchCardData {
  viewerName: string;
  viewerAvatarUrl?: string | null;
  subjectName: string;
  subjectAvatarUrl?: string | null;
  score: number;
  blendPersonality: string;
  sharedGenres: string[];
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  name: string,
  x: number,
  y: number,
  radius: number,
  accent: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    const scale = Math.max((radius * 2) / image.width, (radius * 2) / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
  } else {
    ctx.fillStyle = "#161616";
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = accent;
    ctx.font = `700 ${radius}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name[0]?.toUpperCase() || "?", x, y + radius * 0.05);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.stroke();
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, text: string) {
  const r = height / 2;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "#f5f0de";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + height / 2 + 2);
}

/**
 * Renders the match report as a shareable PNG on an offscreen canvas — same
 * canvas.toDataURL/toBlob approach already used for avatar processing in
 * profile/edit, no new dependency. Avatars are loaded with crossOrigin so the
 * canvas stays untainted; if an avatar host doesn't serve CORS headers, we
 * fall back to an initials circle for that person rather than failing the
 * whole export.
 */
export async function generateMatchCardBlob(data: MatchCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  gradient.addColorStop(0, "#0a0a0a");
  gradient.addColorStop(1, "#171009");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffb36b";
  ctx.font = "700 30px sans-serif";
  ctx.fillText("M O V I E   M A T C H   R E P O R T", CARD_WIDTH / 2, 130);

  let viewerImage: HTMLImageElement | null = null;
  let subjectImage: HTMLImageElement | null = null;
  try {
    if (data.viewerAvatarUrl) viewerImage = await loadImage(data.viewerAvatarUrl);
  } catch {
    viewerImage = null;
  }
  try {
    if (data.subjectAvatarUrl) subjectImage = await loadImage(data.subjectAvatarUrl);
  } catch {
    subjectImage = null;
  }

  const avatarY = 280;
  const avatarRadius = 90;
  drawAvatar(ctx, viewerImage, data.viewerName, CARD_WIDTH / 2 - 160, avatarY, avatarRadius, "#ff7a1a");
  drawAvatar(ctx, subjectImage, data.subjectName, CARD_WIDTH / 2 + 160, avatarY, avatarRadius, "#ffb36b");

  ctx.fillStyle = "#f5f0de";
  ctx.font = "600 36px sans-serif";
  ctx.fillText(`${data.viewerName} + ${data.subjectName}`, CARD_WIDTH / 2, avatarY + 150);

  ctx.fillStyle = "#ff7a1a";
  ctx.font = "900 240px sans-serif";
  ctx.fillText(`${data.score}%`, CARD_WIDTH / 2, 800);

  ctx.fillStyle = "#f5f0de";
  ctx.font = "600 32px sans-serif";
  ctx.fillText(data.blendPersonality, CARD_WIDTH / 2, 860);

  if (data.sharedGenres.length > 0) {
    ctx.font = "600 26px sans-serif";
    const pills = data.sharedGenres.slice(0, 4).map((genre) => genre.toUpperCase());
    const pillHeight = 56;
    const pillPaddingX = 28;
    const gap = 18;
    const widths = pills.map((text) => ctx.measureText(text).width + pillPaddingX * 2);
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (pills.length - 1);
    let x = CARD_WIDTH / 2 - totalWidth / 2;
    const y = 940;

    pills.forEach((text, index) => {
      drawPill(ctx, x, y, widths[index], pillHeight, text);
      x += widths[index] + gap;
    });
  }

  ctx.fillStyle = "rgba(245,240,222,0.4)";
  ctx.font = "600 24px sans-serif";
  ctx.fillText("CANISTERR · MOVIE MATCHER", CARD_WIDTH / 2, CARD_HEIGHT - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export match card"));
    }, "image/png");
  });
}

export type ShareMatchCardResult = "shared" | "downloaded" | "failed";

/**
 * Generates the card and either hands it to the native share sheet (when the
 * browser supports sharing files) or falls back to a direct download.
 */
export async function shareMatchCard(data: MatchCardData): Promise<ShareMatchCardResult> {
  try {
    const blob = await generateMatchCardBlob(data);
    const fileName = `movie-match-${data.viewerName}-${data.subjectName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const file = new File([blob], `${fileName || "movie-match"}.png`, { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Movie Match Report",
        text: `${data.viewerName} and ${data.subjectName} are a ${data.score}% movie match!`,
      });
      return "shared";
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch (error) {
    console.error("shareMatchCard failed:", error);
    return "failed";
  }
}

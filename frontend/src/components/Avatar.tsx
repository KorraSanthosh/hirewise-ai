import { BASE } from "../api";

export default function Avatar({ name, url, size = 36 }: { name?: string; url?: string | null; size?: number }) {
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };
  return url
    ? <img className="avatar" style={style} src={`${BASE}${url}`} alt={name || "Profile photo"} />
    : <span className="avatar" style={style} aria-hidden="true">{initials}</span>;
}

// Center-crop to a square and shrink to ~400px JPEG so uploads stay small.
export function resizeImage(file: File, size = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = Math.min(size, s);
      canvas.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error("That file is not a readable image")); };
    img.src = src;
  });
}

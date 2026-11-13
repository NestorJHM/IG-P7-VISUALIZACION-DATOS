const clamp = (t) => Math.max(0, Math.min(1, t));
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export function solarState(minute) {
  const progress = clamp((minute - 420) / 780),
    azimuth = Math.PI / 2 + progress * Math.PI;
  const altitude = (Math.sin(progress * Math.PI) * (90 - 28.13) * Math.PI) / 180;
  const daylight = smooth((minute - 420) / 45) * (1 - smooth((minute - 1155) / 45));
  const twilight = smooth((minute - 375) / 45) * (1 - smooth((minute - 1200) / 45));
  const horizon = Math.cos(altitude);
  return {
    x: Math.sin(azimuth) * horizon * 10000,
    y: Math.sin(altitude) * 10000,
    z: -Math.cos(azimuth) * horizon * 10000,
    daylight,
    twilight,
    altitude,
  };
}

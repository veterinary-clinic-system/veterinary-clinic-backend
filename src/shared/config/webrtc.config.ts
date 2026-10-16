import { registerAs } from '@nestjs/config';

const DEFAULT_STUN_URLS = 'stun:stun.l.google.com:19302';

function splitUrls(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

/**
 * Máy chủ ICE cho cuộc gọi WebRTC. STUN đủ cho hai máy cùng mạng hoặc NAT thông thường;
 * ra Internet thật (4G, NAT đối xứng) thì cần TURN - đặt WEBRTC_TURN_URLS kèm tài khoản.
 */
export default registerAs('webrtc', () => {
  const stunUrls = splitUrls(process.env.WEBRTC_STUN_URLS ?? DEFAULT_STUN_URLS);
  const turnUrls = splitUrls(process.env.WEBRTC_TURN_URLS);

  const iceServers: { urls: string[]; username?: string; credential?: string }[] = [];
  if (stunUrls.length > 0) iceServers.push({ urls: stunUrls });
  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      username: process.env.WEBRTC_TURN_USERNAME,
      credential: process.env.WEBRTC_TURN_CREDENTIAL,
    });
  }
  return { iceServers };
});

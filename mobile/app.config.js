const fs = require('fs');

/**
 * app.json 에 빌드할 때만 정해지는 값을 더한다.
 * 안드로이드 푸시 알림(FCM)은 Firebase 의 google-services.json 이 있어야 한다:
 *  - EAS 빌드: 파일형 환경 변수 GOOGLE_SERVICES_JSON (Expo 프로젝트 → Environment variables)
 *  - 로컬: mobile/google-services.json
 * 없으면 그냥 빌드한다 (앱은 동작하고 안드로이드 푸시만 오지 않는다)
 */
module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(`${__dirname}/google-services.json`) ? './google-services.json' : undefined);
  return googleServicesFile ? { ...config, android: { ...config.android, googleServicesFile } } : config;
};

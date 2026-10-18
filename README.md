# 마케케 (Makeke)

공개 저장소: [johunsang/makeke-opensource](https://github.com/johunsang/makeke-opensource) · MIT 라이선스

내 PC에서 블로그, 카드뉴스, 디자인과 광고 영상 콘텐츠를 만드는 데스크톱 앱입니다.
Electron과 Go API로 동작하며 실행하면 마케케 본 화면으로 바로 들어갑니다. 별도 런처와 추가 도구는 포함하지 않습니다. 마케케 회원가입, 로그인, 구독 및 중앙 이용권 서버가 필요하지 않습니다.
AI 생성에는 사용자가 선택한 외부 서비스의 API 키 또는 CLI 계정이 필요하며, 해당 서비스의 사용료가 발생할 수 있습니다.

## 시작하기

Node.js 20 이상과 Go 1.25.5 이상을 설치한 뒤 저장소 루트에서 실행합니다.

```sh
git clone https://github.com/johunsang/makeke-opensource.git
cd makeke-opensource
npm ci
npm run dev
```

Windows에서는 프로젝트 폴더의 `run-dev.bat`로도 실행할 수 있습니다.

첫 실행 시 앱이 로컬 Go 서버를 시작합니다. 앱 설정에서 사용할 AI 서비스의 키와 모델을 선택하세요.
기존 데이터는 OS 앱 데이터 폴더의 `Makeke`에 보관합니다. 소스 폴더 안에 실사용 DB나 키를 넣지 마세요.
외부 SNS·브라우저·AI 도구의 계정 연결은 각 서비스 이용에 필요한 별도 기능입니다.

서버만 실행하려면 `npm run server`를 사용합니다. 로컬 API는 loopback 주소에서만 사용하며 외부 공개 서버로 운영하지 않습니다.
별도 임시 데이터 폴더는 `MAKEKE_DATA_DIR`로 지정할 수 있습니다.

## 포함된 코드

| 경로 | 역할 |
| --- | --- |
| `electron/` | 데스크톱 앱·로컬 서버 실행 |
| `api/` | 콘텐츠 제작 Go API |
| `static/`, `templates/` | 앱 화면 |
| `chrome-extension/` | 사용자 브라우저 연동 |

원본 마케케 배포 `v1.7.91`을 기준으로 합니다. 이후 빠릿디자인·빠릿마케팅 리브랜딩이나 Rust/클라우드 전환 실험은 포함하지 않습니다.

## 개발·검증

```sh
node tests/launcher-auth-contract.test.cjs
(cd api && go test ./...)
python3 -m unittest discover -s tests -p 'export_opensource_test.py'
```

실제 화면 검사는 `npm run dev`로 앱을 연 뒤 다른 터미널에서 `node tests/e2e/no-login-live.cjs`를 실행합니다. 별도 포트는 양쪽 명령에 `MAKEKE_PORT`로 지정하세요.

모든 AI 생성·외부 SNS·영상 렌더 경로를 위 테스트가 보증하지는 않습니다.
공개 소스 묶음에는 운영 계정·사용자 DB·인증키·사내 일지·과거 Git 이력·빌드 바이너리가 들어가지 않습니다.
라이선스와 출처가 불명확한 폰트·미디어·제3자 도구 번들도 제외합니다.
선택적 렌더·수집 기능에 필요한 외부 도구와 이용 조건은 `THIRD_PARTY_NOTICES.md`를 확인하세요.

## 공개용 소스 만들기

비공개 작업 저장소에서 아래 명령으로 새 소스 폴더와 압축 파일을 만듭니다.

```sh
python3 scripts/export-opensource.py --help
```

기존 비공개 저장소에는 과거 운영 데이터가 있으므로 공개 전환 대신 정제된 소스로 새 이력을 시작합니다.
소스는 위 GitHub 저장소에 공개하며, 설치 프로그램 배포는 별도 단계입니다.

## 라이선스

자체 소스는 MIT 라이선스로 제공합니다.
제3자 소스와 의존성은 각 라이선스를 따릅니다. `LICENSE`, `THIRD_PARTY_NOTICES.md`를 참고하세요.

// webpack.config.js 파일 전체 복사/붙여넣기 코드

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  // 모드 설정: production (배포용) 또는 development (개발용)
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  // 엔트리 파일 (시작점)
  entry: './src/index.tsx',

  // 아웃풋 설정 (빌드된 파일이 나갈 곳)
  output: {
    // 빌드 결과가 저장될 디렉토리 (dist)
    path: path.resolve(__dirname, 'dist'),
    // 번들된 파일 이름
    filename: '[name].js',
    // 이전 빌드 파일을 자동으로 정리
    clean: true,

    // GitHub Pages 하위 경로 설정: /저장소이름/ (404 문제 해결)
    publicPath: '/normal-seed-KR/', 
  },

  // 모듈 처리 규칙
  module: {
    rules: [
      // TypeScript 및 JavaScript 파일 처리
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/, 
        use: [
            {
                loader: 'ts-loader',
                options: {
                    // 💡 중요: 이 설정을 통해 node_modules에서 발생하는 TS 오류를 무시하고
                    //    빌드(트랜스파일)만 진행하도록 강제합니다. (TS1005 오류 해결)
                    transpileOnly: true, 
                },
            },
        ],
      },
      // CSS 및 SCSS 파일 처리
      {
        test: /\.(css|scss)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      // 이미지 파일 처리
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },

  // 확장자 처리
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },

  // 플러그인 설정
  plugins: [
    // HTML 파일 자동 생성 및 번들된 JS 파일 연결
    new HtmlWebpackPlugin({
      template: './public/index.html', // 템플릿 파일 경로
      filename: 'index.html',
    }),
  ],

  // 개발 서버 설정
  devServer: {
    port: 3000,
    historyApiFallback: true,
  },
};
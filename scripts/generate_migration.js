import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, '..', 'data', 'photos.json');
const outputPath = path.join(__dirname, '..', 'docs', 'migration.sql');

try {
  if (!fs.existsSync(jsonPath)) {
    console.error('photos.json file not found!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  
  // JSON 파일 내의 "id" 블록들을 정규식으로 추출합니다 (JSON이 깨졌을 경우를 대비)
  const idRegex = /"id":\s*"([^"]+)"/g;
  const urlRegex = /"url":\s*"([^"]+)"/g;
  const dateRegex = /"date":\s*"([^"]+)"/g;
  const themeRegex = /"theme":\s*"([^",\n]+)/g; // 따옴표가 닫히지 않은 깨짐 현상 처리
  const googleUrlRegex = /"originalGoogleUrl":\s*"([^"]+)"/g;
  const isCoverRegex = /"isCover":\s*(true|false)/g;
  const descRegex = /"description":\s*"([^"]*)"/g;

  let ids = [];
  let match;
  while ((match = idRegex.exec(rawData)) !== null) ids.push(match[1]);

  let urls = [];
  while ((match = urlRegex.exec(rawData)) !== null) urls.push(match[1]);

  let dates = [];
  while ((match = dateRegex.exec(rawData)) !== null) dates.push(match[1]);

  let themes = [];
  while ((match = themeRegex.exec(rawData)) !== null) themes.push(match[1].replace(/"/g, '').trim());

  let googleUrls = [];
  while ((match = googleUrlRegex.exec(rawData)) !== null) googleUrls.push(match[1]);

  let isCovers = [];
  while ((match = isCoverRegex.exec(rawData)) !== null) isCovers.push(match[1]);

  let descs = [];
  while ((match = descRegex.exec(rawData)) !== null) descs.push(match[1]);

  if (ids.length === 0) {
    console.log('No photos to migrate or parsing failed.');
    process.exit(0);
  }

  let sqlChunks = [];
  sqlChunks.push('-- 기존 photos.json 데이터 마이그레이션 쿼리 (손상 복구 정규식 파서 사용)');
  sqlChunks.push('-- 복사해서 Supabase SQL Editor에 일괄 실행하세요!\n');

  for (let i = 0; i < ids.length; i++) {
    const escapeSql = (str) => {
      if (!str) return 'NULL';
      return `'${str.replace(/'/g, "''")}'`;
    };

    const id = escapeSql(ids[i]);
    const url = escapeSql(urls[i]);
    const original_google_url = escapeSql(googleUrls[i]);
    const mime_type = "'image/jpeg'";
    const date = escapeSql(dates[i]);
    const theme = escapeSql(themes[i] || '기타 추억');
    const description = escapeSql(descs[i]);
    const comment = 'NULL';
    const is_cover = isCovers[i] === 'true' ? 'true' : 'false';
    const is_synced = 'true'; // 과거 파일시스템 데이터이므로 로드된 것으로 간주

    const query = `INSERT INTO public.photos (id, url, original_google_url, mime_type, date, theme, comment, description, is_cover, is_synced)
VALUES (${id}, ${url}, ${original_google_url}, ${mime_type}, ${date}, ${theme}, ${comment}, ${description}, ${is_cover}, ${is_synced})
ON CONFLICT (id) DO NOTHING;`;

    sqlChunks.push(query);
  }


  fs.writeFileSync(outputPath, sqlChunks.join('\n'));
  console.log(`Success! Created ${ids.length} SQL insert statements at docs/migration.sql`);

} catch (err) {
  console.error('Error generating migration SQL:', err);
}

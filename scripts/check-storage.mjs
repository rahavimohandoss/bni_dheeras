// Checks object-storage credentials before putting them in Vercel:
// upload a small text file, read it back, print a presigned link, report
// whether the bucket is private (recommended), then delete the test file.
//
//   node scripts/check-storage.mjs            (bucket from STORAGE_BUCKET)
//   node scripts/check-storage.mjs assets     (or name the bucket)
//
// Reads .env and .env.local. Accepts the app's STORAGE_* names or the AWS_*
// names that Neon's "Connect → Storage" panel shows.
import { config } from "dotenv";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

config({ path: [".env.local", ".env"], quiet: true });
const env = process.env;

const endpoint = (env.STORAGE_ENDPOINT || env.AWS_ENDPOINT_URL_S3 || "").replace(/\/+$/, "");
const region = env.STORAGE_REGION || env.AWS_REGION || "auto";
const accessKeyId = env.STORAGE_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;
const bucket = process.argv[2] || env.STORAGE_BUCKET;

const missing = [
  !endpoint && "STORAGE_ENDPOINT (or AWS_ENDPOINT_URL_S3)",
  !accessKeyId && "STORAGE_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID)",
  !secretAccessKey && "STORAGE_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY)",
  !bucket && "STORAGE_BUCKET (or pass the bucket name as an argument)",
].filter(Boolean);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const key = `uploads/check-${Date.now()}.txt`;

console.log(`endpoint ${endpoint}\nbucket   ${bucket}\nkey      ${key}`);
await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "Hello World!", ContentType: "text/plain" }));
console.log("✓ upload");

const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
console.log(`✓ read back: "${await got.Body.transformToString()}"`);

const signed = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
console.log(`✓ presigned link (1 hour): ${signed.split("?")[0]}?…`);

const publicUrl = `${endpoint}/${bucket}/${key}`;
const anon = await fetch(publicUrl).catch(() => null);
console.log(
  anon?.ok
    ? `! bucket is publicly readable — anyone with a link can see files. Private is recommended: the app serves photos itself (/api/media).`
    : `✓ bucket is private (anonymous read → HTTP ${anon?.status ?? "error"}). Good: the app serves photos to members via /api/media.`,
);

await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log("✓ test file deleted");

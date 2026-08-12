import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import * as tus from "tus-js-client";

const archive=process.argv[2];
const token=process.env.HOSTINGER_API_TOKEN;
if(!archive||!token) throw new Error("missing_deploy_input");

const username="u398929082";
const domain="lex-saas.homosapiens.id";
const base="https://developers.hostinger.com/";
const headers={
  Authorization:`Bearer ${token}`,
  "Content-Type":"application/json",
  Accept:"application/json"
};

const creds=await axios.post(
  `${base}api/hosting/v1/files/upload-urls`,
  {username,domain},
  {headers,timeout:60000}
);
const uploadUrl=creds.data.url;
const authToken=creds.data.auth_key;
const authRestToken=creds.data.rest_auth_key;
if(!uploadUrl||!authToken||!authRestToken) throw new Error("invalid_upload_credentials");

const stats=fs.statSync(archive);
const clean=uploadUrl.replace(/\/$/,"");
const remote=`${clean}/${path.basename(archive)}?override=true`;
const uploadHeaders={
  "X-Auth":authToken,
  "X-Auth-Rest":authRestToken,
  "upload-length":String(stats.size),
  "upload-offset":"0"
};
await axios.post(remote,"",{headers:uploadHeaders,timeout:60000,validateStatus:s=>s===201});

await new Promise((resolve,reject)=>{
  const upload=new tus.Upload(fs.createReadStream(archive),{
    uploadUrl:remote,
    retryDelays:[1000,2000,4000],
    uploadDataDuringCreation:false,
    parallelUploads:1,
    chunkSize:10485760,
    headers:uploadHeaders,
    removeFingerprintOnSuccess:true,
    uploadSize:stats.size,
    metadata:{filename:path.basename(archive)},
    onError:reject,
    onSuccess:resolve
  });
  upload.start();
});

const buildData={
  node_version:20,
  app_type:"express",
  root_directory:null,
  output_directory:null,
  build_script:null,
  entry_file:"server.js",
  package_manager:"npm",
  source_type:"archive",
  source_options:{archive_path:path.basename(archive)}
};
const build=await axios.post(
  `${base}api/hosting/v1/accounts/${username}/websites/${domain}/nodejs/builds`,
  buildData,
  {headers,timeout:60000}
);
console.log(JSON.stringify({status:"submitted",uuid:build.data?.uuid||build.data?.id||null,archive:path.basename(archive)}));

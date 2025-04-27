import 'dotenv/config';
import { Client } from 'basic-ftp';

async function example() {
  const client = new Client();

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: false,
    });

    await client.cd(process.env.FTP_PATH!);
    await client.uploadFromDir('public/models', 'models');
  } catch (err) {
    console.log(err);
  }
  client.close();
}

example();
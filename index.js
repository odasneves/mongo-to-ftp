const spawn = require("child_process").spawn;
const fs = require("fs");
const fsExtra = require("fs-extra");
const nodemailer = require("nodemailer");
const SFTPClient = require("ssh2-sftp-client");
const zipFolder = require("zip-folder");

const settings = require("./settings");

const now = new Date().getTime();

const emailBodyArray = [];

const log = (msg) => {
  emailBodyArray.push(msg);
};

const sftpClean = async () => {
  const sftp = new SFTPClient();

  try {
    await sftp.connect({
      host: settings.ftpSettings.host,
      port: settings.ftpSettings.port,
      username: settings.ftpSettings.username,
      password: settings.ftpSettings.password,
    });
    const data = await sftp.list(settings.ftpSettings.path);
    const orderedData = data.sort((a, b) => {
      return b.modifyTime - a.modifyTime;
    });
    const dataToDelete = orderedData.splice(settings.filesToKeep);
    dataToDelete.forEach(async (data) => {
      await sftp.delete(settings.ftpSettings.path + data.name);
    });
    await sftp.end();
  } catch (err) {
    console.log(err);
  }
};

const cleanFS = async () => {
  await fsExtra.emptyDir(settings.mongoOutputFolder);
  await fsExtra.emptyDir(settings.zipOutputFolder);
};

const sendEmail = async () => {
  const transporter = nodemailer.createTransport({
    host: settings.mailSettings.host,
    port: settings.mailSettings.port,
    secure: settings.mailSettings.secure,
    auth: {
      user: settings.mailSettings.auth.user,
      pass: settings.mailSettings.auth.pass,
    },
  });

  await transporter.sendMail({
    from: settings.mailSettings.auth.user,
    to: settings.mailSettings.mailList,
    subject: settings.mailSettings.subject,
    html: emailBodyArray.join("<br />"),
  });
};

const sftpSend = async () => {
  const sftp = new SFTPClient();
  const data = fs.createReadStream(getZipLocalFilename());
  const remote = settings.ftpSettings.path + getZipFilename();

  try {
    await sftp.connect({
      host: settings.ftpSettings.host,
      port: settings.ftpSettings.port,
      username: settings.ftpSettings.username,
      password: settings.ftpSettings.password,
    });
    await sftp.put(data, remote);
    await sftp.end();
  } catch (err) {
    log(err);
  }
};

const runMongodump = (done) => {
  let counter = 0;
  settings.mongodumpParams.forEach((entry) => {
    const args = [];
    entry.out = settings.mongoOutputFolder;
    Object.keys(entry).forEach((arg) => {
      args.push("--" + arg, entry[arg]);
    });
    log("Running mongodump on: " + entry.db);
    const mongodump = spawn(settings.mongodumpPath, args);

    mongodump.stdout.on("data", (data) => {
      log(`stdout: ${data}`);
    });

    mongodump.stderr.on("data", (data) => {
      log(`stderr: ${data}`);
    });

    mongodump.on("close", () => {
      counter++;
      log("Database backed up to " + settings.mongoOutputFolder);
      if (counter === settings.mongodumpParams.length) {
        done();
      }
    });
  });
};

const createZipFile = (done) => {
  log("Zipping " + settings.mongoOutputFolder + " ...");
  zipFolder(settings.mongoOutputFolder, getZipLocalFilename(), function (err) {
    if (err) {
      log(err);
    } else {
      log("Backup saved as " + getZipLocalFilename());
      done();
    }
  });
};

const getZipLocalFilename = () => {
  return settings.zipOutputFolder + "/" + getZipFilename();
};

const getZipFilename = () => {
  return settings.backupName + now + ".zip";
};

runMongodump(() => {
  createZipFile(async () => {
    await sftpSend();
    log("Sent to ftp server");
    await sendEmail();
    log("Email sent");
    await cleanFS();
    log("Clean filesystem");
    await sftpClean();
    log("Clean ftp");
  });
});

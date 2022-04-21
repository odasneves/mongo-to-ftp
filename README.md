
# Mongo to ftp
Javascript tool for mongodb backups to ftp.
## Install

    create outputfolder and zipfolder
    npm install
    create settings.js
    
### settings.js
    module.exports = {
      mongodumpPath: "C:/path/to/mongodump.exe",
      mongoOutputFolder: "< outputfolder >",
      zipOutputFolder: "< zipfolder >",
      mongodumpParams: [
        {
          host: "localhost:27017",
          db: "db",
          username: "db",
          password: "db",
          authenticationDatabase: "db",
        },
      ],
      ftpSettings: {
        host: "ftpServer",
        port: "22",
        username: "ftp",
        password: "ftp",
        path: "/",
      },
      backupName: "dump",
      filesToKeep: 7,
      mailSettings: {
        host: "smtp.server",
        port: 465,
        secure: true,
        auth: {
          user: "xpto@xpto.com",
          pass: "xpto",
        },
        mailList: "test@xpto.com",
        subject: "MongoDB Backup",
      },
    };

### pm2 usage

    pm2 start ./apps.conf.env.json (check config for cron)

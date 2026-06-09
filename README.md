# Aurora

Aurora is a custom Discordjs bot for [Valorant Romania](https://discord.com/invite/valorantromania).

## Requirements for running the project

- Latest version of Node.js
- Postgresql database

## Installation for Linux Server

This installation guide uses Debian.

### Create a sudoer user account

```bash
adduser server # any username, server is used in this example

usermod -aG sudo server
```

### Change from root to user

```bash
su - server
```

### Make sure the system is up to date

```bash
sudo apt update
sudo apt upgrade
```

### Postgresql installation

Install packages

```bash
sudo apt install postgresql postgresql-contrib -y
```

Check the status of the service using systemctl

```bash
sudo systemctl status postgresql
```

If systemctl is not installed simply use `sudo apt install systemctl`

After checking the status, you must see something like `Active: active (running).
Otherwise run:

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Linux should automatically create the postgres superuser. Connect as postgres.

```bash
sudo -iu postgres
psql
```

Create the database and its owner user

```bash
CREATE USER aurora WITH PASSWORD 'passwd'; # use your own user name and password

CREATE DATABASE auroradb OWNER aurorauser; # use your own database name and set the user created as owner

GRANT ALL PRIVILEGES ON DATABASE auroradb TO aurora; # grant full access to your user
```

Exit psql and change user account

```bash
\q
su - server
```

Change directory to postgresql installation to check which version is installed

```bash
cd /etc/postgresql/
ls
```

In my case, version 16 is installed.

Open the config file using your text editor of choice.

```bash
sudo nano 16/main/pg_hba.conf
```

Look for this line and change `METHOD` to md5 to access the database on localhost using the password set.

```bash
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     md5
```

Save changes and restart the service

```bash
sudo systemctl restart postgresql
```

Now you can access the database from the terminal by connecting to it locally

```bash
psql -U aurora -d auroradb -h localhost # will ask for the password provided when the user was created
```

### Node.js installation

Node.js will be installed using `fnm`.

Make sure you are in the sudoer account created

```bash
\q # to leave the database connection
su - server
```

Install curl if it's not already installed

```bash
sudo apt install curl unzip # unzip is a dependency needed
```

Installing fnm

```bash
curl -o- https://fnm.vercel.app/install | bash
```

In order for the current shell to recognize fnm run

```bash
source ~/.bashrc
```

Install node

```bash
fnm install 24 # or the latest version on nodejs.org
```

Check if node installed correctly

```bash
node -v
npm -v
```

### Setting up the project

Install git if it's not already installed

```bash
sudo apt install git
```

Make sure to change directory in the desired location, for example in the home directory.

```bash
cd ~
```

Private repositories require an authentication method.

I will be using ssh. How a ssh key is generated and assigned to your GitHub account is out of this guide's scope so please look up a guide for that before proceeding with the following steps.

Start the SSH agent

```bash
eval "$(ssh-agent -s)"
```

Add the ssh key

```bash
ssh-add keys/gitkey
```

Clone the project

```bash
git clone git@github.com:rootblind/aurora-bot.git
```

Go inside the project directory

```bash
cd aurora-bot/
```

Install dependencies

```bash
npm install
```

Rename `.env.example` into `.env` or create a new file with that name and complete the data required.

```bash
cp .env.example .env
```

Open `.env` and set the environment variables.

```bash
nano .env
```

Use the existing scripts to build and run the project

```bash
npm run build
npm run start
```

## Author

- [@rootblind](https://github.com/rootblind)

## Contributors

## License
[GPL v3](https://github.com/rootblind/justice-bot-template/blob/main/LICENSE)
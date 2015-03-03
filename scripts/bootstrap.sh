#!/bin/bash
cd $HOME

echo "Installing git"
sudo apt-get install git

echo "Installing bitcoind and bitcoin-cli"
sudo apt-add-repository ppa:bitcoin/bitcoin -y
sudo apt-get update
sudo apt-get install bitcoind -y
echo "Configuring JSONRPC for bitcoin."
echo "Please enter a password for bitcoind daemon (approximately 30 random characters. You do NOT have to remember this password)"
read -s bitcoin_rpc_password
echo "rpcuser=bitcoinrpc" >> "$HOME/.bitcoin/bitcoin.conf"
echo "rpcpassword=$bitcoin_rpc_password" >> "$HOME/.bitcoin/bitcoin.conf"
unset bitcoin_rpc_password

echo "Installing mysql client and server"
echo "You will prompted for a password, please remember the password and select a secure one."
echo "You are only required to remember it once throughout the installation process (it will be prompted later)"
sudo apt-get install mysql-server mysql-client -y
sudo service mysql start

# SETPS ABOVE HERE ARE OKAY

echo "Installing nvm and node.js"
curl https://raw.githubusercontent.com/creationix/nvm/v0.23.3/install.sh | bash
echo "Reloading shell to start using nvm"
source ~/.bashrc # To make sure nvm is available for use
nvm install 0.10.31
nvm use 0.10.31
nvm alias default 0.10.31

## REMEMBER CHANGE GIT REPO INTO PROPER NPM PACKAGE AND UPDATE PACKAGE IN npm

echo "Installing Blockchain-certificate Protocol"
npm install -g blockchain-certificate
npm install -g supervisor

# Create the necessary directories or setup the required users
echo "Creating .blockchain-certificate directory"
mkdir .blockchain-certificate
cd .blockchain-certificate
mkdir logs

echo "Choose a password for your mysql user!"
read -s mysql_password
echo "Creating mysql user"
mysql -u root -p -e "CREATE USER bcpuser IDENTIFIED BY '$mysql_password';CREATE DATABASE bcpproduction;GRANT ALL on bcpproduction.* TO bcpuser;"

# Configure and define the environment variables
echo "" >> "$HOME/.bashrc"
echo "Do you want to run the server on the testnet?(y/n)"
read run_on_test_net
if [ "$run_on_test_net" == "y" ]; then
    echo "export TESTNET='true'" >> "$HOME/.bashrc"
else
    echo "Response is not 'y'!"
    echo "Not running on the testnet!"
fi

echo "How much of transaction fee you want to incur for every transaction? (defaults to 0.0001)"
read transaction_fee
if [ "$transaction_fee" == "" ]; then
    echo "export TRANSACTION_FEE=0.0001" >> "$HOME/.bashrc"
else
    echo "export TRANSACTION_FEE=($transaction_fee)">> "$HOME/.bashrc" 
fi

echo "How much you want to spend on every transaction? (defaults to 0.0001)"
read transaction_amount
if [ "$transaction_amount" == "" ]; then
    echo "export TRANSACTION_AMOUNT=0.0001" >> "$HOME/.~bashrc"
else
    echo "export TRANSACTION_AMOUNT=$transaction_amount" >> "$HOME/.bashrc"
fi

echo "export NODE_ENV='production'" >> "$HOME/.bashrc"

source ~/.bashrc

# CHECK IF CONFIG FILE ACTUALLY WORKS
# Now do the .blockchain-certificate config files
echo "What is your mysql user's password? The password is the one we prompted for just now."
echo "Make sure it is the right password. We will NOT carry out any form of validation!"
read -s mysql_password
bcp-config-bootstrap $mysql_password
unset mysql_password

# startup MYSQL and bitcoind
sudo service mysql restart
if [ "$TESTNET" == "true" ];then
    echo "Running testnet daemon"
    bitcoind --testnet -daemon
else
    echo "Running mainnet daemon"
    bitcoind -daemon
fi

source ~/.bashrc
echo "BCP is now ready to rock!"
echo "Just hit bcp-daemon to start the daemon!"
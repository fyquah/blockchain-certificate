#!/bin/bash
cd $HOME

# Install all the dependencies first
echo "Installing bitcoind and bitcoin-cli"
sudo apt-add-repository ppa:bitcoin/bitcoin -y
sudo apt-get update
sudo apt-get install bitcoind -y

echo "Installing mysql client and server"
echo "You will prompted for a password, please remember the password and select a secure one."
echo "You are only required to remember it once throughout the installation process (it will be prompted later)"
sudo apt-get install mysql-server-5.6 mysql-client-5.6 -y

echo "Installing nvm and node.js"
curl https://raw.githubusercontent.com/creationix/nvm/v0.23.3/install.sh | bash
nvm install 0.10.31
nvm use 0.10.31
nvm alias default 0.10.31

echo "Installing Blockchain-certificate Protocol"
npm install -g blockchain-certificate
npm install -g supervisor

# Create the necessary directories or setup the required users
echo "Creating .blockchain-certificate directory"
mkdir .blockchain-certificate
cd .blockchain-certificate
mkdir logs

echo "Choose a password for your mysql user!"
read mysql_password
echo "Creating mysql user"
mysql -u root -p -e "CREATE USER 'bcpuser'@localhost IDENTIFIED BY '$mysql_password'"
mysql -u root -p -e "CREATE DATABASE bcpproduction"
mysql -u root -p -e "GRANT ALL on bcpproduction TO bcpuser"

# Configure the environment variables here
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
if [ "$transaction" == "" ]; then
    echo "export TRANSACTION_FEE=0.0001" >> "$HOME/.bashrc"
else
    echo "export TRANSACTION_FEE=($transaction_fee)">> "$HOME/.bashrc" 
fi

echo "How much you want to spend on every transaction?"
read transaction_amount
if [ "$transaction_amount" == "" ]; then
    echo "export TRANSACTION_AMOUNT=0.0001" >> "$HOME/.~bashrc"
else
    echo "export TRANSACTION_AMOUNT=$(transaction_amount)" >> "$HOME/.bashrc"
fi

echo "export NODE_ENV='production'" >> "$HOME/.bashrc"

source ~/.bashrc

# Now do the .blockchain-certificate config files
echo "What is your mysql user's password? The password is the one we prompted for just now."
read mysql_password
bcp-config-bootstrap $mysql_password

# startup the bcp!
sudo service mysql restart
source ~/.bashrc
echo "BCP is now ready to rock!"
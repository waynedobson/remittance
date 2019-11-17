const path = require("path");

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  // contracts_build_directory: path.join(__dirname, "client/src/contracts"),
  networks: {
    test: {
      host: "192.168.1.10", // Localhost (default: none)
      network_id: 5777, // Any network (default: none)
      port: 7545
    }
  },
  compilers: {
    solc: {
      version: "0.5.11" // ex:  "0.4.20". (Default: Truffle's installed solc)
    }
  }
};

import Web3 from "web3";
import $ from "jquery";
import remittanceJson from "../../build/contracts/Remittance.json";
import "file-loader?name=../index.html!../index.html";

window.App = {};

window.addEventListener("load", function() {
  const devMode = true;

  if (window.ethereum && !devMode) {
    App.web3 = new Web3(currentProvider);
    window.ethereum.enable();
  } else {
    App.web3 = new Web3(
      new Web3.providers.HttpProvider("http://localhost:7545")
    );
  }

  App.start();
});

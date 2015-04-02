var Fluxxor = require('fluxxor');
var constants = require('../constants');

var state = {
  markets: {}
};

var MarketStore = Fluxxor.createStore({
  initialize: {
    this.bindActions(
      constants.market.LOAD_MARKETS_SUCCESS, this.handleLoadMarketsSuccess
    );
  },

  getState: function () {
    return state;
  },

  handleLoadMarketsSuccess: function (payload) {
    state.markets = payload.markets;
    this.emit(constants.CHANGE_EVENT);
  }
};

module.exports = MarketStore;

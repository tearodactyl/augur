import { describe, it } from 'mocha';
import { assert } from 'chai';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import proxyquire from 'proxyquire';
import sinon from 'sinon';
import BigNumber from 'bignumber.js';

import { getBestFill } from 'modules/my-positions/actions/close-position';

import { BUY, SELL } from 'modules/trade/constants/types';
import { UPDATE_TRADE_COMMIT_LOCK } from 'modules/trade/actions/update-trade-commitment';

describe('modules/my-positions/actions/close-position.js', () => {
  proxyquire.noPreserveCache().noCallThru();

  const middlewares = [thunk];
  const mockStore = configureMockStore(middlewares);

  const MOCK_ACTION_TYPES = {
    CLEAR_CLOSE_POSITION_OUTCOME: 'CLEAR_CLOSE_POSITION_OUTCOME',
    ADD_CLOSE_POSITION_TRADE_GROUP: 'ADD_CLOSE_POSITION_TRADE_GROUP'
  };

  describe('closePosition', () => {
    const mockUpdateTradesInProgress = {
      updateTradesInProgress: () => {}
    };
    sinon.stub(mockUpdateTradesInProgress, 'updateTradesInProgress', (marketID, outcomeID, side, numShares, limitPrice, maxCost, cb) => (dispatch, getState) => cb());
    const mockClearClosePositionOutcome = {
      clearClosePositionOutcome: sinon.stub().returns({ type: MOCK_ACTION_TYPES.CLEAR_CLOSE_POSITION_OUTCOME })
    };
    const mockPlaceTrade = {
      placeTrade: () => {}
    };
    const mockAddClosePositionTradeGroup = {
      addClosePositionTradeGroup: sinon.stub().returns({
        type: MOCK_ACTION_TYPES.ADD_CLOSE_POSITION_TRADE_GROUP
      })
    };
    const mockLoadBidsAsks = {
      loadBidsAsks: () => {}
    };
    sinon.stub(mockLoadBidsAsks, 'loadBidsAsks', (marketID, cb) => dispatch => cb());
    const mockMarkets = sinon.stub().returns([
      {
        id: '0xMARKETID',
        myPositionOutcomes: [
          {
            id: '1',
            position: {
              qtyShares: {
                value: 10
              }
            }
          }
        ]
      }
    ]);

    const action = proxyquire('../../../src/modules/my-positions/actions/close-position.js', {
      '../../trade/actions/update-trades-in-progress': mockUpdateTradesInProgress,
      '../../trade/actions/place-trade': mockPlaceTrade,
      './add-close-position-trade-group': mockAddClosePositionTradeGroup,
      './clear-close-position-outcome': mockClearClosePositionOutcome,
      '../../bids-asks/actions/load-bids-asks': mockLoadBidsAsks,
      '../../markets/selectors/markets-all': mockMarkets
    });

    afterEach(() => {
      mockPlaceTrade.placeTrade.restore();
    });

    const test = (t) => {
      it(t.description, () => {
        const store = mockStore(t.state || {});

        sinon.stub(mockPlaceTrade, 'placeTrade', (marketID, outcomeID, tradesInProgress, doNotMakeOrders, cb) => (dispatch, getState) => {
          if (t.placeTradeFails) {
            cb(true);
          } else {
            cb(null, t.tradeGroupID);
          }
        });

        t.assertions(store);
      });
    };

    test({
      description: `should dispatch the expected actions WITHOUT available orders`,
      state: {
        marketID: '0xMARKETID',
        outcomeID: '1',
        orderBooks: {
          '0xMARKETID': {
            [BUY]: {},
            [SELL]: {}
          }
        },
        loginAccount: {
          address: '0xUSERADDRESS'
        }
      },
      assertions: (store) => {
        const { marketID, outcomeID } = store.getState();
        store.dispatch(action.closePosition(marketID, outcomeID));

        const actual = store.getActions();

        const expected = [
          {
            type: UPDATE_TRADE_COMMIT_LOCK,
            isLocked: true
          },
          {
            type: MOCK_ACTION_TYPES.ADD_CLOSE_POSITION_TRADE_GROUP
          },
          {
            type: UPDATE_TRADE_COMMIT_LOCK,
            isLocked: false
          },
          {
            type: MOCK_ACTION_TYPES.CLEAR_CLOSE_POSITION_OUTCOME
          },
          {
            type: MOCK_ACTION_TYPES.ADD_CLOSE_POSITION_TRADE_GROUP
          }
        ];

        assert.deepEqual(actual, expected, `Didn't dispatch the expected actions`);
      }
    });

    test({
      description: `should dispatch the expected actions WITH available orders AND placeTrade fails`,
      state: {
        marketID: '0xMARKETID',
        outcomeID: '1',
        orderBooks: {
          '0xMARKETID': {
            [BUY]: {
              '0xORDERID1': {
                outcome: '1',
                fullPrecisionAmount: '2',
                fullPrecisionPrice: '0.3'
              },
              '0xORDERID2': {
                outcome: '1',
                fullPrecisionAmount: '13',
                fullPrecisionPrice: '0.31'
              },
              '0xORDERID3': {
                outcome: '2',
                fullPrecisionAmount: '11',
                fullPrecisionPrice: '0.7'
              },
              '0xORDERID4': {
                outcome: '1',
                fullPrecisionAmount: '11',
                fullPrecisionPrice: '0.8',
                owner: '0xUSERADDRESS'
              }
            },
            [SELL]: {}
          }
        },
        tradesInProgress: {},
        loginAccount: {
          address: '0xUSERADDRESS'
        },
        marketsData: {
          '0xMARKETID': {
            myPositionOutcomes: [
              0: {
                id: '1',
                position: {
                  qtyShares: {
                    value: 10
                  }
                }
              }
            ]
          }
        }
      },
      placeTradeFails: true,
      assertions: (store) => {
        const { marketID, outcomeID } = store.getState();
        store.dispatch(action.closePosition(marketID, outcomeID));

        const actual = store.getActions();

        const expected = [
          {
            type: UPDATE_TRADE_COMMIT_LOCK,
            isLocked: true
          },
          {
            type: MOCK_ACTION_TYPES.ADD_CLOSE_POSITION_TRADE_GROUP
          },
          {
            type: UPDATE_TRADE_COMMIT_LOCK,
            isLocked: false
          },
          {
            type: MOCK_ACTION_TYPES.ADD_CLOSE_POSITION_TRADE_GROUP
          }
        ];

        assert.deepEqual(actual, expected, `Didn't dispatch the expected actions`);
      }
    });

    test({
      description: `should dispatch the expected actions WITH available orders AND placeTrade succeeds`,
      state: {
        marketID: '0xMARKETID',
        outcomeID: '1',
        accountPositions: {
          '0xMARKETID': {
            1: '10',
            2: '0',
            3: '0'
          }
        },
        orderBooks: {
          '0xMARKETID': {
            [BUY]: {
              '0xORDERID1': {
                outcome: '1',
                fullPrecisionAmount: '2',
                fullPrecisionPrice: '0.3'
              },
              '0xORDERID2': {
                outcome: '1',
                fullPrecisionAmount: '13',
                fullPrecisionPrice: '0.31'
              },
              '0xORDERID3': {
                outcome: '2',
                fullPrecisionAmount: '11',
                fullPrecisionPrice: '0.7'
              },
              '0xORDERID4': {
                outcome: '1',
                fullPrecisionAmount: '11',
                fullPrecisionPrice: '0.8',
                owner: '0xUSERADDRESS'
              }
            },
            [SELL]: {}
          }
        },
        tradesInProgress: {},
        loginAccount: {
          address: '0xUSERADDRESS'
        }
      },
      assertions: (store) => {
        const { marketID, outcomeID } = store.getState();
        store.dispatch(action.closePosition(marketID, outcomeID));

        const actual = store.getActions();

        const expected = [
          {
            type: UPDATE_TRADE_COMMIT_LOCK,
            isLocked: true
          },
          {
            type: MOCK_ACTION_TYPES.ADD_CLOSE_POSITION_TRADE_GROUP
          },
          {
            type: MOCK_ACTION_TYPES.ADD_CLOSE_POSITION_TRADE_GROUP
          }
        ];

        assert.deepEqual(actual, expected, `Didn't dispatch the expected actions`);
      }
    });
  });

  describe('getBestFill', () => {
    const test = (t) => {
      it(t.description, () => {
        const bestFill = getBestFill(t.state.orderBook, t.arguments.side, t.arguments.shares, t.arguments.marketID, t.arguments.outcomeID, t.arguments.userAddress);

        t.assertions(bestFill);
      });
    };

    test({
      description: `-1 share position, empty order book`,
      state: {
        orderBook: {}
      },
      arguments: {
        side: SELL,
        shares: new BigNumber(-1).absoluteValue(),
        marketID: '0xMarketID1',
        outcomeID: '1',
        userAddress: '0xUSERADDRESS'
      },
      assertions: (bestFill) => {
        assert.deepEqual(bestFill, {
          amountOfShares: new BigNumber(0),
          price: new BigNumber(0)
        });
      }
    });

    test({
      description: `1 share position, empty order book`,
      state: {
        orderBook: {}
      },
      arguments: {
        side: BUY,
        shares: new BigNumber(1).absoluteValue(),
        marketID: '0xMarketID1',
        outcomeID: '1',
        userAddress: '0xUSERADDRESS'
      },
      assertions: (bestFill) => {
        assert.deepEqual(bestFill, {
          amountOfShares: new BigNumber(0),
          price: new BigNumber(0)
        });
      }
    });

    test({
      description: `10 shares position, sufficent order book depth to fully close`,
      state: {
        orderBook: {
          [BUY]: {
            '0xOrderID1': {
              fullPrecisionAmount: '2',
              fullPrecisionPrice: '0.11',
              outcome: '1'
            },
            '0xOrderID2': {
              fullPrecisionAmount: '8',
              fullPrecisionPrice: '0.2',
              outcome: '1'
            },
            '0xOrderID3': {
              fullPrecisionAmount: '8',
              fullPrecisionPrice: '0.8',
              outcome: '1',
              owner: '0xUSERADDRESS'
            }
          }
        }
      },
      arguments: {
        side: BUY,
        shares: new BigNumber(10).absoluteValue(),
        marketID: '0xMarketID1',
        outcomeID: '1',
        userAddress: '0xUSERADDRESS'
      },
      assertions: (bestFill) => {
        assert.deepEqual(bestFill, {
          amountOfShares: new BigNumber(10),
          price: new BigNumber(0.11)
        });
      }
    });

    test({
      description: `10 shares position, sufficent order book depth for a partial close`,
      state: {
        orderBook: {
          [BUY]: {
            '0xOrderID1': {
              fullPrecisionAmount: '2',
              fullPrecisionPrice: '0.11',
              outcome: '1'
            },
            '0xOrderID2': {
              fullPrecisionAmount: '1',
              fullPrecisionPrice: '0.10',
              outcome: '1'
            },
            '0xOrderID3': {
              fullPrecisionAmount: '8',
              fullPrecisionPrice: '0.8',
              outcome: '1',
              owner: '0xUSERADDRESS'
            }
          }
        }
      },
      arguments: {
        side: BUY,
        shares: new BigNumber(10).absoluteValue(),
        marketID: '0xMarketID1',
        outcomeID: '1',
        userAddress: '0xUSERADDRESS'
      },
      assertions: (bestFill) => {
        assert.deepEqual(bestFill, {
          amountOfShares: new BigNumber(3),
          price: new BigNumber(0.10)
        });
      }
    });

    test({
      description: `-10 shares position, sufficent order book depth to fully close`,
      state: {
        orderBook: {
          [SELL]: {
            '0xOrderID1': {
              fullPrecisionAmount: '2',
              fullPrecisionPrice: '0.11',
              outcome: '1'
            },
            '0xOrderID2': {
              fullPrecisionAmount: '8',
              fullPrecisionPrice: '0.2',
              outcome: '1'
            },
            '0xOrderID3': {
              fullPrecisionAmount: '8',
              fullPrecisionPrice: '0.01',
              outcome: '1',
              owner: '0xUSERADDRESS'
            }
          }
        }
      },
      arguments: {
        side: SELL,
        shares: new BigNumber(-10).absoluteValue(),
        marketID: '0xMarketID1',
        outcomeID: '1',
        userAddress: '0xUSERADDRESS'
      },
      assertions: (bestFill) => {
        assert.deepEqual(bestFill, {
          amountOfShares: new BigNumber(10),
          price: new BigNumber(0.2)
        });
      }
    });

    test({
      description: `-10 shares position, sufficent order book depth for a partial close`,
      state: {
        orderBook: {
          [SELL]: {
            '0xOrderID1': {
              fullPrecisionAmount: '2',
              fullPrecisionPrice: '0.11',
              outcome: '1'
            },
            '0xOrderID2': {
              fullPrecisionAmount: '1',
              fullPrecisionPrice: '0.10',
              outcome: '1'
            },
            '0xOrderID3': {
              fullPrecisionAmount: '8',
              fullPrecisionPrice: '0.01',
              outcome: '1',
              owner: '0xUSERADDRESS'
            }
          }
        }
      },
      arguments: {
        side: SELL,
        shares: new BigNumber(-10).absoluteValue(),
        marketID: '0xMarketID1',
        outcomeID: '1',
        userAddress: '0xUSERADDRESS'
      },
      assertions: (bestFill) => {
        assert.deepEqual(bestFill, {
          amountOfShares: new BigNumber(3),
          price: new BigNumber(0.11)
        });
      }
    });
  });
});
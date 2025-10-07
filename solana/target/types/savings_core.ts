/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/savings_core.json`.
 */
export type SavingsCore = {
  "address": "HNi2JKTNeHvz2ENckdVBW1ncfkJUYppuYeBwNhWjkK7d",
  "metadata": {
    "name": "savingsCore",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Savings Wallet Core Program"
  },
  "instructions": [
    {
      "name": "addTimePeriodLimit",
      "docs": [
        "Add or update a time period limit"
      ],
      "discriminator": [
        241,
        217,
        123,
        93,
        14,
        188,
        236,
        51
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "limit",
          "type": "u64"
        },
        {
          "name": "duration",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addWithdrawalDestination",
      "docs": [
        "Add a withdrawal destination"
      ],
      "discriminator": [
        22,
        253,
        18,
        184,
        234,
        85,
        147,
        84
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "pubkey"
        },
        {
          "name": "title",
          "type": "string"
        }
      ]
    },
    {
      "name": "cancelLimitProposal",
      "docs": [
        "Cancel a pending proposal"
      ],
      "discriminator": [
        201,
        126,
        142,
        5,
        126,
        97,
        232,
        133
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "cancelWithdrawalBypass",
      "docs": [
        "Cancel withdrawal bypass request"
      ],
      "discriminator": [
        67,
        241,
        187,
        146,
        79,
        62,
        136,
        181
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "requestId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "cancelWithdrawalDestinationRequest",
      "docs": [
        "Cancel a pending withdrawal destination request"
      ],
      "discriminator": [
        233,
        183,
        160,
        123,
        7,
        15,
        61,
        197
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "requestId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "commitInitialSetup",
      "docs": [
        "Commit initial setup"
      ],
      "discriminator": [
        248,
        193,
        240,
        26,
        1,
        132,
        74,
        226
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "depositSol",
      "docs": [
        "Deposit SOL to the savings account (supports CPI)"
      ],
      "discriminator": [
        108,
        81,
        78,
        117,
        125,
        155,
        56,
        200
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "beneficiary"
              }
            ]
          }
        },
        {
          "name": "beneficiary",
          "docs": [
            "The beneficiary whose savings account will be credited"
          ]
        },
        {
          "name": "payer",
          "docs": [
            "The payer for account creation and transaction fees"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositSolSelf",
      "docs": [
        "Deposit SOL for self (backward compatibility)"
      ],
      "discriminator": [
        253,
        113,
        121,
        194,
        75,
        233,
        114,
        223
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositSpl",
      "docs": [
        "Deposit SPL tokens to the savings account (supports CPI)"
      ],
      "discriminator": [
        224,
        0,
        198,
        175,
        198,
        47,
        105,
        204
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "beneficiary"
              }
            ]
          }
        },
        {
          "name": "beneficiary",
          "docs": [
            "The beneficiary whose savings account will be credited"
          ]
        },
        {
          "name": "payer",
          "docs": [
            "The payer for account creation and transaction fees"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "sourceTokenAccount",
          "docs": [
            "Source token account that holds the tokens to deposit"
          ],
          "writable": true
        },
        {
          "name": "savingsTokenAccount",
          "docs": [
            "The savings account's token account for this mint"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "savingsAccount"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "mint",
          "docs": [
            "The mint of the SPL token being deposited"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositSplSelf",
      "docs": [
        "Deposit SPL tokens for self (backward compatibility)"
      ],
      "discriminator": [
        177,
        32,
        212,
        139,
        117,
        61,
        41,
        95
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userTokenAccount",
          "docs": [
            "User's token account that holds the tokens to deposit"
          ],
          "writable": true
        },
        {
          "name": "savingsTokenAccount",
          "docs": [
            "The savings account's token account for this mint"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "savingsAccount"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "mint",
          "docs": [
            "The mint of the SPL token being deposited"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "executeLimitProposal",
      "docs": [
        "Execute a pending proposal"
      ],
      "discriminator": [
        77,
        88,
        235,
        59,
        216,
        111,
        1,
        133
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "executeSplWithdrawalBypass",
      "docs": [
        "Execute SPL withdrawal bypass"
      ],
      "discriminator": [
        241,
        42,
        36,
        134,
        236,
        241,
        142,
        40
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "Token mint"
          ]
        },
        {
          "name": "savingsTokenAccount",
          "docs": [
            "User's token account for sending"
          ],
          "writable": true
        },
        {
          "name": "destinationTokenAccount",
          "docs": [
            "Destination token account for receiving"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "requestId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "executeWithdrawalBypass",
      "docs": [
        "Execute withdrawal bypass (SOL)"
      ],
      "discriminator": [
        179,
        43,
        138,
        230,
        25,
        62,
        50,
        189
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "requestId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "executeWithdrawalDestinationRequest",
      "docs": [
        "Execute a pending withdrawal destination request"
      ],
      "discriminator": [
        117,
        222,
        85,
        202,
        28,
        30,
        24,
        66
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "requestId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "getSolBalance",
      "docs": [
        "Get user's total SOL balance"
      ],
      "discriminator": [
        177,
        197,
        179,
        97,
        50,
        111,
        178,
        70
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "signer": true
        }
      ],
      "args": [],
      "returns": "u64"
    },
    {
      "name": "getSpendingLimits",
      "docs": [
        "Get spending limits information"
      ],
      "discriminator": [
        23,
        121,
        238,
        204,
        69,
        213,
        157,
        147
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "getSplBalance",
      "docs": [
        "Get user's SPL token balance for a specific mint"
      ],
      "discriminator": [
        92,
        135,
        40,
        171,
        133,
        246,
        90,
        120
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "mint",
          "type": "pubkey"
        }
      ],
      "returns": "u64"
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize a savings account for a user"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeSpendingLimits",
      "docs": [
        "Initialize a spending limits account for a user"
      ],
      "discriminator": [
        240,
        49,
        54,
        19,
        46,
        201,
        202,
        42
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "proposeLimitChange",
      "docs": [
        "Propose a spending limit change"
      ],
      "discriminator": [
        146,
        253,
        178,
        82,
        191,
        64,
        35,
        251
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "periodName",
          "type": "string"
        },
        {
          "name": "newLimit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "removeTimePeriodLimit",
      "docs": [
        "Remove a time period limit"
      ],
      "discriminator": [
        213,
        185,
        190,
        218,
        206,
        221,
        93,
        152
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        }
      ]
    },
    {
      "name": "removeWithdrawalDestination",
      "docs": [
        "Remove a withdrawal destination"
      ],
      "discriminator": [
        60,
        84,
        70,
        83,
        98,
        9,
        151,
        106
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "requestWithdrawalBypass",
      "docs": [
        "Request withdrawal bypass for amounts exceeding spending limits"
      ],
      "discriminator": [
        179,
        63,
        197,
        165,
        24,
        134,
        204,
        54
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "tokenMint",
          "type": "pubkey"
        },
        {
          "name": "bypassingPeriod",
          "type": "string"
        },
        {
          "name": "destination",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "requestWithdrawalDestinationAddition",
      "docs": [
        "Request withdrawal destination addition (with timelock)"
      ],
      "discriminator": [
        249,
        50,
        136,
        94,
        75,
        10,
        162,
        98
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "pubkey"
        },
        {
          "name": "title",
          "type": "string"
        }
      ]
    },
    {
      "name": "setCommonPeriodLimits",
      "docs": [
        "Set common period limits (Daily, Weekly, Monthly)"
      ],
      "discriminator": [
        200,
        130,
        17,
        128,
        169,
        59,
        33,
        89
      ],
      "accounts": [
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "dailyLimit",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "weeklyLimit",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "monthlyLimit",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "withdrawSol",
      "docs": [
        "Withdraw SOL from the savings account"
      ],
      "discriminator": [
        145,
        131,
        74,
        136,
        65,
        137,
        42,
        38
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawSolToDestination",
      "docs": [
        "Withdraw SOL to destination"
      ],
      "discriminator": [
        170,
        140,
        47,
        249,
        105,
        179,
        11,
        204
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawSolWithLimits",
      "docs": [
        "Withdraw SOL with spending limits validation"
      ],
      "discriminator": [
        75,
        241,
        60,
        175,
        113,
        191,
        138,
        113
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawSpl",
      "docs": [
        "Withdraw SPL tokens from the savings account"
      ],
      "discriminator": [
        181,
        154,
        94,
        86,
        62,
        115,
        6,
        186
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userTokenAccount",
          "docs": [
            "User's token account to receive the withdrawn tokens"
          ],
          "writable": true
        },
        {
          "name": "savingsTokenAccount",
          "docs": [
            "The savings account's token account for this mint"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "savingsAccount"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "mint",
          "docs": [
            "The mint of the SPL token being withdrawn"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawSplToDestination",
      "docs": [
        "Withdraw SPL tokens to destination"
      ],
      "discriminator": [
        30,
        228,
        247,
        163,
        185,
        59,
        123,
        128
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "docs": [
            "Token mint"
          ]
        },
        {
          "name": "savingsTokenAccount",
          "docs": [
            "User's token account for sending"
          ],
          "writable": true
        },
        {
          "name": "destinationTokenAccount",
          "docs": [
            "Destination token account for receiving"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawSplWithLimits",
      "docs": [
        "Withdraw SPL tokens with spending limits validation"
      ],
      "discriminator": [
        103,
        31,
        251,
        151,
        88,
        136,
        64,
        53
      ],
      "accounts": [
        {
          "name": "savingsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  118,
                  105,
                  110,
                  103,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "spendingLimitsAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userTokenAccount",
          "docs": [
            "User's token account to receive the withdrawn tokens"
          ],
          "writable": true
        },
        {
          "name": "savingsTokenAccount",
          "docs": [
            "The savings account's token account for this mint"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "savingsAccount"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "mint",
          "docs": [
            "The mint of the SPL token being withdrawn"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "savingsAccount",
      "discriminator": [
        136,
        151,
        16,
        72,
        219,
        51,
        51,
        116
      ]
    },
    {
      "name": "spendingLimitsAccount",
      "discriminator": [
        38,
        33,
        131,
        233,
        159,
        154,
        149,
        66
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Invalid amount: amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "arithmeticOverflow",
      "msg": "Math overflow occurred"
    },
    {
      "code": 6002,
      "name": "tokenLimitExceeded",
      "msg": "Too many different tokens in account (max 10 supported)"
    },
    {
      "code": 6003,
      "name": "insufficientBalance",
      "msg": "Insufficient balance for this operation"
    },
    {
      "code": 6004,
      "name": "unauthorizedAccess",
      "msg": "Unauthorized access to this savings account"
    },
    {
      "code": 6005,
      "name": "accountNotInitialized",
      "msg": "Account not properly initialized"
    },
    {
      "code": 6006,
      "name": "spendingLimitExceeded",
      "msg": "Spending limit exceeded for this time period"
    },
    {
      "code": 6007,
      "name": "invalidLimitParameters",
      "msg": "Invalid spending limit parameters"
    },
    {
      "code": 6008,
      "name": "setupNotCommitted",
      "msg": "Setup must be committed before withdrawals are allowed"
    },
    {
      "code": 6009,
      "name": "spendingLimitsNotFound",
      "msg": "Spending limits account not found"
    },
    {
      "code": 6010,
      "name": "periodLimitNotFound",
      "msg": "Period limit not found"
    },
    {
      "code": 6011,
      "name": "invalidParameters",
      "msg": "Invalid parameters provided"
    },
    {
      "code": 6012,
      "name": "tooManyDestinations",
      "msg": "Too many withdrawal destinations (max 20 allowed)"
    },
    {
      "code": 6013,
      "name": "destinationAlreadyExists",
      "msg": "Destination address already exists"
    },
    {
      "code": 6014,
      "name": "cannotSetOwnAddress",
      "msg": "Cannot set own address as withdrawal destination"
    },
    {
      "code": 6015,
      "name": "destinationNotFound",
      "msg": "Withdrawal destination not found"
    },
    {
      "code": 6016,
      "name": "destinationNotApproved",
      "msg": "Destination is not approved for withdrawals"
    },
    {
      "code": 6017,
      "name": "tooManyBypassRequests",
      "msg": "Too many bypass requests (max 10 allowed)"
    },
    {
      "code": 6018,
      "name": "requestStillInTimelock",
      "msg": "Request is still in timelock period"
    },
    {
      "code": 6019,
      "name": "requestNotFound",
      "msg": "Bypass request not found"
    }
  ],
  "types": [
    {
      "name": "bypassRequest",
      "docs": [
        "Represents a pending bypass request for withdrawals exceeding spending limits"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "requestId",
            "docs": [
              "Unique identifier for this request"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "Amount to withdraw (in lamports for SOL, token units for SPL)"
            ],
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "docs": [
              "Token mint (use System Program ID for SOL)"
            ],
            "type": "pubkey"
          },
          {
            "name": "bypassingPeriod",
            "docs": [
              "Which spending period this request is bypassing"
            ],
            "type": "string"
          },
          {
            "name": "destination",
            "docs": [
              "Destination address for the withdrawal"
            ],
            "type": "pubkey"
          },
          {
            "name": "executeAfter",
            "docs": [
              "Unix timestamp when this request can be executed (24 hours after creation)"
            ],
            "type": "i64"
          },
          {
            "name": "executed",
            "docs": [
              "Whether this request has been executed"
            ],
            "type": "bool"
          },
          {
            "name": "cancelled",
            "docs": [
              "Whether this request has been cancelled"
            ],
            "type": "bool"
          },
          {
            "name": "createdAt",
            "docs": [
              "When this request was created"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pendingProposal",
      "docs": [
        "Pending proposal for spending limit changes (mirrors EVM proposal system)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "docs": [
              "Unique identifier for this proposal"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "periodName",
            "docs": [
              "Period name being modified (\"Daily\", \"Weekly\", \"Monthly\", etc.)"
            ],
            "type": "string"
          },
          {
            "name": "newLimit",
            "docs": [
              "New limit being proposed"
            ],
            "type": "u64"
          },
          {
            "name": "executeAfter",
            "docs": [
              "Unix timestamp when this proposal can be executed"
            ],
            "type": "i64"
          },
          {
            "name": "executed",
            "docs": [
              "Whether this proposal has been executed"
            ],
            "type": "bool"
          },
          {
            "name": "isIncrease",
            "docs": [
              "Whether this is a limit increase (true) or decrease/removal (false)"
            ],
            "type": "bool"
          },
          {
            "name": "createdAt",
            "docs": [
              "When this proposal was created"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pendingWithdrawalDestinationRequest",
      "docs": [
        "Represents a pending withdrawal destination request (similar to EVM timelock system)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "requestId",
            "docs": [
              "Unique identifier for this request"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "address",
            "docs": [
              "The destination address to be added"
            ],
            "type": "pubkey"
          },
          {
            "name": "title",
            "docs": [
              "Title/label for this destination"
            ],
            "type": "string"
          },
          {
            "name": "executeAfter",
            "docs": [
              "Unix timestamp when this request can be executed (24 hours after creation)"
            ],
            "type": "i64"
          },
          {
            "name": "executed",
            "docs": [
              "Whether this request has been executed"
            ],
            "type": "bool"
          },
          {
            "name": "cancelled",
            "docs": [
              "Whether this request has been cancelled"
            ],
            "type": "bool"
          },
          {
            "name": "createdAt",
            "docs": [
              "When this request was created"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "savingsAccount",
      "docs": [
        "Main savings account that stores user's deposit information",
        "Similar to the userTokenBalances mapping in your EVM contract"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The owner of this savings account"
            ],
            "type": "pubkey"
          },
          {
            "name": "solBalance",
            "docs": [
              "Total SOL deposited (in lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "splBalances",
            "docs": [
              "SPL token balances"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "tokenBalance"
                }
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for this PDA"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "When this account was created"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Last update timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "withdrawalDestinations",
            "docs": [
              "Approved withdrawal destinations (addresses user can withdraw to)"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "withdrawalDestination"
                }
              }
            }
          },
          {
            "name": "pendingWithdrawalDestinationRequests",
            "docs": [
              "Pending withdrawal destination requests (addresses pending approval with timelock)"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "pendingWithdrawalDestinationRequest"
                }
              }
            }
          },
          {
            "name": "pendingBypassRequests",
            "docs": [
              "Pending bypass requests for withdrawals exceeding spending limits"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "bypassRequest"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "spendingLimitsAccount",
      "docs": [
        "Spending limits account that stores user's spending control configuration",
        "Similar to the userSpendingLimits mapping in your EVM contract"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The owner of this spending limits account"
            ],
            "type": "pubkey"
          },
          {
            "name": "timePeriodLimits",
            "docs": [
              "Array of time-based spending limits (Daily, Weekly, Monthly, Custom)"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "timePeriodLimit"
                }
              }
            }
          },
          {
            "name": "pendingProposals",
            "docs": [
              "Pending proposals for limit changes (mirrors EVM proposal system)"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "pendingProposal"
                }
              }
            }
          },
          {
            "name": "setupData",
            "docs": [
              "Setup and configuration data"
            ],
            "type": {
              "defined": {
                "name": "userSetupData"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "Bump seed for this PDA"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "When this account was created"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Last update timestamp"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "timePeriodLimit",
      "docs": [
        "Represents a time-based spending limit (mirrors EVM TimePeriodLimit struct)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "limit",
            "docs": [
              "Spending limit for this period (in lamports for SOL, token amount for SPL)"
            ],
            "type": "u64"
          },
          {
            "name": "spent",
            "docs": [
              "Amount spent in current period"
            ],
            "type": "u64"
          },
          {
            "name": "lastReset",
            "docs": [
              "When this period was last reset (Unix timestamp)"
            ],
            "type": "i64"
          },
          {
            "name": "duration",
            "docs": [
              "Period duration in seconds (86400 for daily, 604800 for weekly, etc.)"
            ],
            "type": "u64"
          },
          {
            "name": "name",
            "docs": [
              "Period name (\"Daily\", \"Weekly\", \"Monthly\", \"Custom Salary\", etc.)"
            ],
            "type": "string"
          },
          {
            "name": "active",
            "docs": [
              "Whether this limit is currently active"
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "tokenBalance",
      "docs": [
        "Represents a balance for a specific SPL token"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "docs": [
              "The mint address of the SPL token"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "The amount of tokens deposited"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userSetupData",
      "docs": [
        "User setup and configuration data (mirrors EVM UserSetupData struct)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hasCommittedSetup",
            "docs": [
              "Track if user has committed initial setup"
            ],
            "type": "bool"
          },
          {
            "name": "totalLockedValue",
            "docs": [
              "Total value locked across all periods (for validation)"
            ],
            "type": "u64"
          },
          {
            "name": "commitTimestamp",
            "docs": [
              "When setup was committed (Unix timestamp)"
            ],
            "type": "i64"
          },
          {
            "name": "lastIncreaseTimestamp",
            "docs": [
              "Track period start for increase limits"
            ],
            "type": "i64"
          },
          {
            "name": "increasesInPeriod",
            "docs": [
              "Amount increased in current 7-day period"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawalDestination",
      "docs": [
        "Represents an approved withdrawal destination address"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "docs": [
              "The destination address"
            ],
            "type": "pubkey"
          },
          {
            "name": "title",
            "docs": [
              "Optional title/label for this destination"
            ],
            "type": "string"
          },
          {
            "name": "addedAt",
            "docs": [
              "When this destination was added"
            ],
            "type": "i64"
          },
          {
            "name": "active",
            "docs": [
              "Whether this destination is currently active"
            ],
            "type": "bool"
          }
        ]
      }
    }
  ]
};

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/savings_core.json`.
 */
export type SavingsCore = {
  "address": "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
  "metadata": {
    "name": "savingsCore",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Savings Wallet Core Program"
  },
  "instructions": [
    {
      "name": "depositSol",
      "docs": [
        "Deposit SOL to the savings account"
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
        "Deposit SPL tokens to the savings account"
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
    }
  ],
  "types": [
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
    }
  ]
};

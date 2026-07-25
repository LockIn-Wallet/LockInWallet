/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/savings_core.json`.
 */
export type SavingsCore = {
  "address": "9j511uJuYwoFRFiU1h5wy2oi1Xc8n1FdoK91QxoXHRh2",
  "metadata": {
    "name": "savingsCore",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana Savings Wallet Core Program"
  },
  "instructions": [
    {
      "name": "addWithdrawalDestination",
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
          "name": "vault",
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "withdrawalDest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108,
                  95,
                  100,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              },
              {
                "kind": "account",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "destination"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        }
      ]
    },
    {
      "name": "cancelBypass",
      "discriminator": [
        232,
        67,
        164,
        11,
        244,
        194,
        195,
        237
      ],
      "accounts": [
        {
          "name": "vault",
          "relations": [
            "vaultMember",
            "bypassRequest"
          ]
        },
        {
          "name": "vaultMember",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "bypassRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  121,
                  112,
                  97,
                  115,
                  115,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember",
            "bypassRequest"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "cancelDestinationRequest",
      "discriminator": [
        255,
        245,
        78,
        237,
        53,
        195,
        7,
        238
      ],
      "accounts": [
        {
          "name": "vault",
          "relations": [
            "vaultMember",
            "pendingRequest"
          ]
        },
        {
          "name": "vaultMember",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "pendingRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  100,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              },
              {
                "kind": "account",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "destination"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember",
            "pendingRequest"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "cancelRuleChange",
      "discriminator": [
        91,
        241,
        197,
        38,
        185,
        169,
        36,
        92
      ],
      "accounts": [
        {
          "name": "vault",
          "relations": [
            "proposal"
          ]
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "claimPenaltyRewards",
      "discriminator": [
        51,
        113,
        194,
        34,
        228,
        128,
        172,
        219
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "claimSplPenaltyRewards",
      "discriminator": [
        11,
        61,
        48,
        49,
        152,
        57,
        163,
        239
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
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
                "path": "tokenMint"
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
          "name": "memberTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "member"
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
                "path": "tokenMint"
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
          "name": "tokenMint"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createSplVault",
      "discriminator": [
        70,
        237,
        30,
        3,
        24,
        231,
        70,
        67
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "vaultNonce"
              }
            ]
          }
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
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
                "path": "tokenMint"
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
          "name": "tokenMint"
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "vaultNonce",
          "type": "u64"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "vaultType",
          "type": {
            "defined": {
              "name": "vaultType"
            }
          }
        },
        {
          "name": "dailyLimit",
          "type": "u64"
        },
        {
          "name": "weeklyLimit",
          "type": "u64"
        },
        {
          "name": "monthlyLimit",
          "type": "u64"
        },
        {
          "name": "penaltyRateBps",
          "type": "u16"
        },
        {
          "name": "limitsArePercentage",
          "type": "bool"
        }
      ]
    },
    {
      "name": "createVault",
      "discriminator": [
        29,
        237,
        247,
        208,
        193,
        82,
        54,
        135
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "vaultNonce"
              }
            ]
          }
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "creator",
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
          "name": "name",
          "type": "string"
        },
        {
          "name": "vaultNonce",
          "type": "u64"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "vaultType",
          "type": {
            "defined": {
              "name": "vaultType"
            }
          }
        },
        {
          "name": "dailyLimit",
          "type": "u64"
        },
        {
          "name": "weeklyLimit",
          "type": "u64"
        },
        {
          "name": "monthlyLimit",
          "type": "u64"
        },
        {
          "name": "penaltyRateBps",
          "type": "u16"
        },
        {
          "name": "limitsArePercentage",
          "type": "bool"
        }
      ]
    },
    {
      "name": "depositSol",
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
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
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
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
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
                "path": "tokenMint"
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
          "name": "memberTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "member"
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
                "path": "tokenMint"
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
          "name": "tokenMint"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
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
      "name": "executeBypassSol",
      "discriminator": [
        230,
        35,
        193,
        232,
        98,
        192,
        95,
        77
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember",
            "bypassRequest"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "bypassRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  121,
                  112,
                  97,
                  115,
                  115,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember",
            "bypassRequest"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeBypassSpl",
      "discriminator": [
        66,
        221,
        128,
        233,
        134,
        52,
        197,
        195
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember",
            "bypassRequest"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "bypassRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  121,
                  112,
                  97,
                  115,
                  115,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
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
                "path": "tokenMint"
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
          "name": "memberTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "member"
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
                "path": "tokenMint"
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
          "name": "tokenMint"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember",
            "bypassRequest"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "executeDestinationRequest",
      "discriminator": [
        95,
        211,
        0,
        122,
        188,
        41,
        61,
        46
      ],
      "accounts": [
        {
          "name": "vault",
          "relations": [
            "vaultMember",
            "pendingRequest"
          ]
        },
        {
          "name": "vaultMember",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "pendingRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  100,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              },
              {
                "kind": "account",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "withdrawalDest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108,
                  95,
                  100,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              },
              {
                "kind": "account",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "destination"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember",
            "pendingRequest"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeRuleChange",
      "discriminator": [
        84,
        93,
        44,
        13,
        64,
        43,
        176,
        238
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "proposal"
          ]
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeProgramConfig",
      "discriminator": [
        6,
        131,
        61,
        237,
        40,
        110,
        83,
        124
      ],
      "accounts": [
        {
          "name": "programConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
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
          "name": "defaultPenaltyRateBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "joinVault",
      "discriminator": [
        73,
        225,
        253,
        176,
        198,
        180,
        207,
        152
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
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
      "name": "leaveVault",
      "discriminator": [
        89,
        198,
        97,
        6,
        231,
        152,
        118,
        242
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "proposeRuleChange",
      "discriminator": [
        242,
        244,
        60,
        185,
        100,
        231,
        68,
        220
      ],
      "accounts": [
        {
          "name": "vault"
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  108,
                  101,
                  95,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "vault"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newDailyLimit",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newWeeklyLimit",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newMonthlyLimit",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newPenaltyRateBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "newLimitsArePercentage",
          "type": {
            "option": "bool"
          }
        }
      ]
    },
    {
      "name": "removeWithdrawalDestination",
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
          "name": "vault",
          "relations": [
            "vaultMember",
            "withdrawalDest"
          ]
        },
        {
          "name": "vaultMember",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "withdrawalDest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  119,
                  105,
                  116,
                  104,
                  100,
                  114,
                  97,
                  119,
                  97,
                  108,
                  95,
                  100,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              },
              {
                "kind": "account",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "destination"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember",
            "withdrawalDest"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "requestBypass",
      "discriminator": [
        250,
        5,
        48,
        228,
        66,
        2,
        188,
        184
      ],
      "accounts": [
        {
          "name": "vault",
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "bypassRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  121,
                  112,
                  97,
                  115,
                  115,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
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
        },
        {
          "name": "isSol",
          "type": "bool"
        }
      ]
    },
    {
      "name": "requestWithdrawalDestination",
      "discriminator": [
        214,
        192,
        95,
        236,
        194,
        244,
        22,
        196
      ],
      "accounts": [
        {
          "name": "vault",
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "pendingRequest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  110,
                  100,
                  105,
                  110,
                  103,
                  95,
                  100,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              },
              {
                "kind": "account",
                "path": "destination"
              }
            ]
          }
        },
        {
          "name": "destination"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateProgramConfig",
      "discriminator": [
        214,
        3,
        187,
        98,
        170,
        106,
        33,
        45
      ],
      "accounts": [
        {
          "name": "programConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "programConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "newTreasury",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newPenaltyRateBps",
          "type": {
            "option": "u16"
          }
        }
      ]
    },
    {
      "name": "updateVaultRules",
      "discriminator": [
        195,
        219,
        47,
        10,
        219,
        203,
        75,
        154
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "vault"
          ]
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
        },
        {
          "name": "penaltyRateBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "limitsArePercentage",
          "type": {
            "option": "bool"
          }
        }
      ]
    },
    {
      "name": "withdrawSol",
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
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
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
      "name": "withdrawSolWithPenalty",
      "discriminator": [
        240,
        110,
        162,
        147,
        195,
        128,
        43,
        135
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "programConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
          ]
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
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
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
                "path": "tokenMint"
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
          "name": "memberTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "member"
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
                "path": "tokenMint"
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
          "name": "tokenMint"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
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
      "name": "withdrawSplWithPenalty",
      "discriminator": [
        21,
        196,
        114,
        73,
        196,
        90,
        228,
        178
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "vaultMember"
          ]
        },
        {
          "name": "vaultMember",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "member"
              }
            ]
          }
        },
        {
          "name": "programConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
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
                "path": "tokenMint"
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
          "name": "memberTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "member"
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
                "path": "tokenMint"
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
          "name": "treasuryTokenAccount",
          "docs": [
            "Treasury ATA for SPL penalty on personal vaults"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
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
                "path": "tokenMint"
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
          "name": "treasury"
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "member",
          "writable": true,
          "signer": true,
          "relations": [
            "vaultMember"
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
      "name": "bypassRequest",
      "discriminator": [
        118,
        86,
        48,
        68,
        69,
        64,
        180,
        78
      ]
    },
    {
      "name": "pendingDestinationRequest",
      "discriminator": [
        86,
        251,
        149,
        176,
        60,
        244,
        117,
        141
      ]
    },
    {
      "name": "programConfig",
      "discriminator": [
        196,
        210,
        90,
        231,
        144,
        149,
        140,
        63
      ]
    },
    {
      "name": "ruleChangeProposal",
      "discriminator": [
        68,
        220,
        255,
        196,
        232,
        2,
        46,
        148
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    },
    {
      "name": "vaultMember",
      "discriminator": [
        26,
        195,
        159,
        142,
        38,
        12,
        117,
        218
      ]
    },
    {
      "name": "withdrawalDestination",
      "discriminator": [
        62,
        214,
        109,
        21,
        186,
        251,
        166,
        109
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6002,
      "name": "insufficientBalance",
      "msg": "Insufficient balance"
    },
    {
      "code": 6003,
      "name": "spendingLimitExceeded",
      "msg": "Spending limit exceeded for this period"
    },
    {
      "code": 6004,
      "name": "invalidVaultName",
      "msg": "Vault name is empty or too long"
    },
    {
      "code": 6005,
      "name": "invalidVaultDescription",
      "msg": "Vault description is too long"
    },
    {
      "code": 6006,
      "name": "invalidLimit",
      "msg": "Invalid limit: percentage mode values must be 0-10000 basis points"
    },
    {
      "code": 6007,
      "name": "invalidPenaltyRate",
      "msg": "Invalid penalty rate: must be 1-5000 basis points (0.01%-50%)"
    },
    {
      "code": 6008,
      "name": "noLimitsSet",
      "msg": "At least one withdrawal limit must be set"
    },
    {
      "code": 6009,
      "name": "communityVaultImmutable",
      "msg": "Only personal vaults allow rule changes"
    },
    {
      "code": 6010,
      "name": "personalVaultOnly",
      "msg": "Cannot join a personal vault"
    },
    {
      "code": 6011,
      "name": "vaultNotActive",
      "msg": "Vault is not active"
    },
    {
      "code": 6012,
      "name": "alreadyMember",
      "msg": "Already a member of this vault"
    },
    {
      "code": 6013,
      "name": "balanceNotZero",
      "msg": "Member balance must be zero to leave"
    },
    {
      "code": 6014,
      "name": "noPenaltyRewards",
      "msg": "No penalty rewards to claim"
    },
    {
      "code": 6015,
      "name": "tokenMintMismatch",
      "msg": "Token mint does not match vault"
    },
    {
      "code": 6016,
      "name": "unauthorized",
      "msg": "Unauthorized: only admin can perform this action"
    },
    {
      "code": 6017,
      "name": "expectedSolVault",
      "msg": "Vault is a SOL vault, use SOL instructions"
    },
    {
      "code": 6018,
      "name": "expectedSplVault",
      "msg": "Vault is an SPL vault, use SPL instructions"
    },
    {
      "code": 6019,
      "name": "weeklyLessThanDaily",
      "msg": "Weekly limit must be >= daily limit"
    },
    {
      "code": 6020,
      "name": "monthlyLessThanWeekly",
      "msg": "Monthly limit must be >= weekly limit"
    },
    {
      "code": 6021,
      "name": "timelockNotExpired",
      "msg": "Timelock has not expired yet"
    },
    {
      "code": 6022,
      "name": "invalidDestinationTitle",
      "msg": "Destination title is empty or too long"
    },
    {
      "code": 6023,
      "name": "cannotAddSelfAsDestination",
      "msg": "Cannot add own address as withdrawal destination"
    },
    {
      "code": 6024,
      "name": "bypassRequestExists",
      "msg": "Active bypass request already exists"
    },
    {
      "code": 6025,
      "name": "proposalAlreadyExists",
      "msg": "Active rule change proposal already exists"
    }
  ],
  "types": [
    {
      "name": "bypassRequest",
      "docs": [
        "A bypass request to withdraw above limits after a timelock.",
        "One active per vault+member. PDA seeds: [\"bypass_request\", vault, member]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "isSol",
            "type": "bool"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "executeAfter",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pendingDestinationRequest",
      "docs": [
        "A pending request to add a withdrawal destination (timelock).",
        "PDA seeds: [\"pending_dest\", vault, member, destination]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "executeAfter",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "programConfig",
      "docs": [
        "Global program configuration."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasuryAddress",
            "type": "pubkey"
          },
          {
            "name": "defaultPenaltyRateBps",
            "type": "u16"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "ruleChangeProposal",
      "docs": [
        "A pending proposal to change vault rules (timelock).",
        "Only one active per vault. PDA seeds: [\"rule_proposal\", vault]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "newDailyLimit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "newWeeklyLimit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "newMonthlyLimit",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "newLimitsArePercentage",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "newPenaltyRateBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "executeAfter",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "A vault holds a single token type with withdrawal limits.",
        "Limits can be fixed amounts (lamports) or percentage-based (bps of balance).",
        "Personal vaults: single member, mutable rules.",
        "Community vaults: multiple members, immutable rules, penalty redistribution."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "vaultType",
            "type": {
              "defined": {
                "name": "vaultType"
              }
            }
          },
          {
            "name": "tokenMint",
            "docs": [
              "SPL token mint. Pubkey::default() means native SOL vault."
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "dailyLimit",
            "docs": [
              "Daily withdrawal limit. Interpretation depends on `limits_are_percentage`.",
              "Fixed mode: amount in lamports/smallest-unit. Percentage mode: basis points (e.g. 500 = 5%)."
            ],
            "type": "u64"
          },
          {
            "name": "weeklyLimit",
            "docs": [
              "Weekly withdrawal limit (same interpretation as daily_limit)."
            ],
            "type": "u64"
          },
          {
            "name": "monthlyLimit",
            "docs": [
              "Monthly withdrawal limit (same interpretation as daily_limit)."
            ],
            "type": "u64"
          },
          {
            "name": "limitsArePercentage",
            "docs": [
              "When true, daily/weekly/monthly_limit are basis points of member balance.",
              "When false, they are fixed amounts in lamports/smallest-unit."
            ],
            "type": "bool"
          },
          {
            "name": "penaltyRateBps",
            "docs": [
              "Penalty rate for instant withdrawals beyond limits (always basis points)"
            ],
            "type": "u16"
          },
          {
            "name": "vaultNonce",
            "docs": [
              "Creator-chosen nonce to allow multiple vaults per creator"
            ],
            "type": "u64"
          },
          {
            "name": "memberCount",
            "type": "u32"
          },
          {
            "name": "totalBalance",
            "docs": [
              "Sum of all member balances (excluding penalty pool)"
            ],
            "type": "u64"
          },
          {
            "name": "accumulatedPenaltyPerShare",
            "docs": [
              "Accumulated penalty per share, scaled by PRECISION (reward-per-share pattern)"
            ],
            "type": "u128"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultMember",
      "docs": [
        "Per-member state within a vault."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "balance",
            "type": "u64"
          },
          {
            "name": "dailySpent",
            "type": "u64"
          },
          {
            "name": "dailyLastReset",
            "type": "i64"
          },
          {
            "name": "weeklySpent",
            "type": "u64"
          },
          {
            "name": "weeklyLastReset",
            "type": "i64"
          },
          {
            "name": "monthlySpent",
            "type": "u64"
          },
          {
            "name": "monthlyLastReset",
            "type": "i64"
          },
          {
            "name": "penaltyDebt",
            "docs": [
              "Reward-per-share debt for penalty redistribution"
            ],
            "type": "u128"
          },
          {
            "name": "unclaimedPenalties",
            "docs": [
              "Accumulated but unclaimed penalty rewards"
            ],
            "type": "u64"
          },
          {
            "name": "joinedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "personal"
          },
          {
            "name": "community"
          }
        ]
      }
    },
    {
      "name": "withdrawalDestination",
      "docs": [
        "An approved withdrawal destination for a vault member.",
        "PDA seeds: [\"withdrawal_dest\", vault, member, destination]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "member",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "addedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

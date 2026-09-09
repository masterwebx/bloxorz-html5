export type SwitchMode = "on" | "off" | "onoff";

export interface BridgeTarget {
  x: number;
  y: number;
  mode: SwitchMode;
}

export interface SwitchDef {
  x: number;
  y: number;
  bridges: BridgeTarget[];
}

export interface SplitDef {
  x: number;
  y: number;
  a: [number, number];
  b: [number, number];
}

export interface LevelDef {
  id: string;
  code: string;
  tiles: string[];
  spawn: [number, number];
  switches: SwitchDef[];
  splits: SplitDef[];
}

export const LEVELS: LevelDef[] = [
  {
    "id": "ez",
    "code": "780464",
    "tiles": [
      "               ",
      "               ",
      "  bbb          ",
      "  bbbbbb       ",
      "  bbbbbbbbb    ",
      "   bbbbbbbbb   ",
      "       bbebb   ",
      "        bbb    ",
      "               ",
      "               "
    ],
    "spawn": [
      3,
      3
    ],
    "switches": [],
    "splits": []
  },
  {
    "id": "pq",
    "code": "290299",
    "tiles": [
      "               ",
      "      bbbb  bbb",
      "bbbb  bbhb  beb",
      "bbsb  bbbb  bbb",
      "bbbb  bbbb  bbb",
      "bbbblrbbbblrbbb",
      "bbbb  bbbb     ",
      "               ",
      "               ",
      "               "
    ],
    "spawn": [
      1,
      5
    ],
    "switches": [
      {
        "x": 2,
        "y": 3,
        "bridges": [
          {
            "x": 4,
            "y": 5,
            "mode": "onoff"
          },
          {
            "x": 5,
            "y": 5,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 8,
        "y": 2,
        "bridges": [
          {
            "x": 10,
            "y": 5,
            "mode": "onoff"
          },
          {
            "x": 11,
            "y": 5,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "ji",
    "code": "918660",
    "tiles": [
      "               ",
      "               ",
      "      bbbbbbb  ",
      "bbbb  bbb  bb  ",
      "bbbbbbbbb  bbbb",
      "bbbb       bbeb",
      "bbbb        bbb",
      "               ",
      "               ",
      "               "
    ],
    "spawn": [
      1,
      5
    ],
    "switches": [],
    "splits": []
  },
  {
    "id": "we",
    "code": "520967",
    "tiles": [
      "               ",
      "   fffffff     ",
      "   fffffff     ",
      "bbbb     bbb   ",
      "bbb       bb   ",
      "bbb       bb   ",
      "bbb  bbbbfffff ",
      "bbb  bbbbfffff ",
      "     beb  ffbf ",
      "     bbb  ffff "
    ],
    "spawn": [
      1,
      6
    ],
    "switches": [],
    "splits": []
  },
  {
    "id": "xx",
    "code": "028431",
    "tiles": [
      "           bbbb",
      " bbbbkqbsbbbbbb",
      " bbbb       bbb",
      " bbsb          ",
      " bbbb          ",
      "   bbbsbkqbbb  ",
      "          bbbbs",
      "bbb       bbbbb",
      "bebbbkqbbbbbb  ",
      "bbbb           "
    ],
    "spawn": [
      13,
      1
    ],
    "switches": [
      {
        "x": 8,
        "y": 1,
        "bridges": [
          {
            "x": 6,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 5,
            "y": 1,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 6,
        "y": 5,
        "bridges": [
          {
            "x": 5,
            "y": 8,
            "mode": "off"
          },
          {
            "x": 6,
            "y": 8,
            "mode": "off"
          }
        ]
      },
      {
        "x": 3,
        "y": 3,
        "bridges": [
          {
            "x": 5,
            "y": 8,
            "mode": "on"
          },
          {
            "x": 6,
            "y": 8,
            "mode": "on"
          }
        ]
      },
      {
        "x": 14,
        "y": 6,
        "bridges": [
          {
            "x": 5,
            "y": 8,
            "mode": "onoff"
          },
          {
            "x": 6,
            "y": 8,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "gg",
    "code": "524383",
    "tiles": [
      "     bbbbbb    ",
      "     b  bbb    ",
      "     b  bbbbb  ",
      "bbbbbb     bbbb",
      "    bbb    bbeb",
      "    bbb     bbb",
      "      b  bb    ",
      "      bbbbb    ",
      "      bbbbb    ",
      "       bbb     "
    ],
    "spawn": [
      0,
      3
    ],
    "switches": [],
    "splits": []
  },
  {
    "id": "fr",
    "code": "189493",
    "tiles": [
      "               ",
      "        bbbb   ",
      "        bbbb   ",
      "bbb     b  bbbb",
      "bbbbbbbbb   beb",
      "bbb    bbh  bbb",
      "bbb    bbb  bbb",
      " bbl   b       ",
      "  bbbbbb       ",
      "               "
    ],
    "spawn": [
      1,
      4
    ],
    "switches": [
      {
        "x": 9,
        "y": 5,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "ss",
    "code": "499707",
    "tiles": [
      "         bbb   ",
      "         bbb   ",
      "         bbb   ",
      "bbbbbb   bbbbbb",
      "bbbbvb   bbbbeb",
      "bbbbbb   bbbbbb",
      "         bbb   ",
      "         bbb   ",
      "         bbb   ",
      "               "
    ],
    "spawn": [
      1,
      4
    ],
    "switches": [],
    "splits": [
      {
        "x": 4,
        "y": 4,
        "a": [
          10,
          1
        ],
        "b": [
          10,
          7
        ]
      }
    ]
  },
  {
    "id": "re",
    "code": "074355",
    "tiles": [
      "               ",
      "               ",
      "               ",
      "bbbb   b   bbbb",
      "bbbb   b   bbvb",
      "bbbbbbbbbbbbbbb",
      "      beb      ",
      "      bbb      ",
      "               ",
      "               "
    ],
    "spawn": [
      1,
      4
    ],
    "switches": [],
    "splits": [
      {
        "x": 13,
        "y": 4,
        "a": [
          12,
          4
        ],
        "b": [
          2,
          4
        ]
      }
    ]
  },
  {
    "id": "pp",
    "code": "300590",
    "tiles": [
      " bbb     bbbbbb",
      " beblrblrbbbbvb",
      " bbb     bbbbl ",
      "          bbbl ",
      "            bb ",
      "             b ",
      "             b ",
      "            bb ",
      "     bbbbb  bb ",
      "     bs  bbbhb "
    ],
    "spawn": [
      10,
      1
    ],
    "switches": [
      {
        "x": 12,
        "y": 9,
        "bridges": [
          {
            "x": 7,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 8,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 13,
            "y": 2,
            "mode": "onoff"
          },
          {
            "x": 13,
            "y": 3,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 6,
        "y": 9,
        "bridges": [
          {
            "x": 4,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 5,
            "y": 1,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 13,
        "y": 1,
        "a": [
          13,
          1
        ],
        "b": [
          10,
          1
        ]
      }
    ]
  },
  {
    "id": "dw",
    "code": "291709",
    "tiles": [
      "   bbbk        ",
      "   bebk        ",
      "   bbb         ",
      "   b   bbbbbb  ",
      "   b   bb  bb  ",
      "  bbbbbbb  bbb ",
      "       bs    b ",
      "       bbbb  b ",
      "       bbbbbbb ",
      "          bbb  "
    ],
    "spawn": [
      2,
      5
    ],
    "switches": [
      {
        "x": 8,
        "y": 6,
        "bridges": [
          {
            "x": 6,
            "y": 0,
            "mode": "off"
          },
          {
            "x": 6,
            "y": 1,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "gt",
    "code": "958640",
    "tiles": [
      "             h ",
      "      bbb  bbb ",
      "      bhbbbbbl ",
      "    bbbbb  bb  ",
      "    bebl   bb  ",
      "  bbbbb   bbbb ",
      " bbbb     bbbb ",
      " bbbb  bbbbb   ",
      "      bbb      ",
      "      bbb      "
    ],
    "spawn": [
      3,
      6
    ],
    "switches": [
      {
        "x": 7,
        "y": 2,
        "bridges": [
          {
            "x": 13,
            "y": 2,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 13,
        "y": 0,
        "bridges": [
          {
            "x": 7,
            "y": 4,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "sb",
    "code": "448106",
    "tiles": [
      " bbbfbbbbfbbbb ",
      " bb        bbb ",
      " bb         bbb",
      " bbb   bbb  bbb",
      " bbbfffbeb  bbb",
      " bbb  fbbb  b  ",
      "   b  fffffbb  ",
      "   bbbffbfff   ",
      "    bbffffff   ",
      "    bbb  bb    "
    ],
    "spawn": [
      13,
      3
    ],
    "switches": [],
    "splits": []
  },
  {
    "id": "ub",
    "code": "210362",
    "tiles": [
      "        bbb    ",
      "   bbb  bbb    ",
      "blrbbbbbbbbbbb ",
      "blrbbb      hb ",
      "b           bb ",
      "b           bb ",
      "b       bbbbbb ",
      "bbbbb   bbb    ",
      " bbeb   bbb    ",
      "  bbb   bbbbbh "
    ],
    "spawn": [
      4,
      2
    ],
    "switches": [
      {
        "x": 12,
        "y": 3,
        "bridges": [
          {
            "x": 1,
            "y": 2,
            "mode": "onoff"
          },
          {
            "x": 2,
            "y": 2,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 13,
        "y": 9,
        "bridges": [
          {
            "x": 1,
            "y": 3,
            "mode": "onoff"
          },
          {
            "x": 2,
            "y": 3,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "ht",
    "code": "098598",
    "tiles": [
      "       bbb  bbb",
      "    bkqbbblrhbb",
      "bblrb  bbb  bbb",
      "bbbbb   s      ",
      "bb             ",
      " b     v       ",
      " b     b       ",
      "bbb   bbb  sbb ",
      "bbbbbbbbbkqbeb ",
      "bbb   bbb  sbb "
    ],
    "spawn": [
      1,
      8
    ],
    "switches": [
      {
        "x": 12,
        "y": 1,
        "bridges": [
          {
            "x": 2,
            "y": 2,
            "mode": "onoff"
          },
          {
            "x": 3,
            "y": 2,
            "mode": "onoff"
          },
          {
            "x": 5,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 6,
            "y": 1,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 8,
        "y": 3,
        "bridges": [
          {
            "x": 5,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 6,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 10,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 11,
            "y": 1,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 11,
        "y": 7,
        "bridges": [
          {
            "x": 9,
            "y": 8,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 8,
            "mode": "off"
          }
        ]
      },
      {
        "x": 11,
        "y": 9,
        "bridges": [
          {
            "x": 9,
            "y": 8,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 8,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 7,
        "y": 5,
        "a": [
          13,
          1
        ],
        "b": [
          1,
          8
        ]
      }
    ]
  },
  {
    "id": "is",
    "code": "000241",
    "tiles": [
      "               ",
      "               ",
      " v        bbb  ",
      "vbvlrhhblrbeb  ",
      " v        bbb  ",
      "               ",
      "               ",
      "  bbb   bbb    ",
      "  bbbbbbbvb    ",
      "  bbb   bbb    "
    ],
    "spawn": [
      3,
      8
    ],
    "switches": [
      {
        "x": 5,
        "y": 3,
        "bridges": [
          {
            "x": 3,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 4,
            "y": 3,
            "mode": "on"
          }
        ]
      },
      {
        "x": 6,
        "y": 3,
        "bridges": [
          {
            "x": 8,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 9,
            "y": 3,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 9,
        "y": 8,
        "a": [
          1,
          2
        ],
        "b": [
          0,
          3
        ]
      },
      {
        "x": 1,
        "y": 2,
        "a": [
          7,
          3
        ],
        "b": [
          5,
          3
        ]
      },
      {
        "x": 0,
        "y": 3,
        "a": [
          2,
          3
        ],
        "b": [
          1,
          2
        ]
      },
      {
        "x": 2,
        "y": 3,
        "a": [
          0,
          3
        ],
        "b": [
          2,
          3
        ]
      },
      {
        "x": 1,
        "y": 4,
        "a": [
          1,
          4
        ],
        "b": [
          0,
          3
        ]
      }
    ]
  },
  {
    "id": "tw",
    "code": "683596",
    "tiles": [
      "bbb            ",
      "bbbbbbbbbl  bbb",
      "bbb    rbbbbbeb",
      "bbb         hhb",
      "bbb            ",
      "bbb            ",
      "bbb   rbbbbbh  ",
      "bbbbbbbbl  bb  ",
      "bsb        bb  ",
      "bbb        bh  "
    ],
    "spawn": [
      1,
      1
    ],
    "switches": [
      {
        "x": 1,
        "y": 8,
        "bridges": [
          {
            "x": 8,
            "y": 7,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 12,
        "y": 6,
        "bridges": [
          {
            "x": 7,
            "y": 2,
            "mode": "on"
          }
        ]
      },
      {
        "x": 12,
        "y": 9,
        "bridges": [
          {
            "x": 9,
            "y": 1,
            "mode": "on"
          },
          {
            "x": 8,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 12,
        "y": 3,
        "bridges": [
          {
            "x": 6,
            "y": 6,
            "mode": "off"
          }
        ]
      },
      {
        "x": 13,
        "y": 3,
        "bridges": [
          {
            "x": 6,
            "y": 6,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "sc",
    "code": "284933",
    "tiles": [
      "               ",
      "       s       ",
      "bbsb   b       ",
      "bbbbb  b       ",
      "bsbbbbbblrbblrb",
      "bbbbbl  b   b  ",
      "bbsb    b   b  ",
      "b       s  bbb ",
      "b         bbeb ",
      "blrh      bbbb "
    ],
    "spawn": [
      2,
      4
    ],
    "switches": [
      {
        "x": 1,
        "y": 4,
        "bridges": [
          {
            "x": 8,
            "y": 4,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 4,
            "mode": "off"
          }
        ]
      },
      {
        "x": 7,
        "y": 1,
        "bridges": [
          {
            "x": 8,
            "y": 4,
            "mode": "on"
          },
          {
            "x": 9,
            "y": 4,
            "mode": "on"
          }
        ]
      },
      {
        "x": 2,
        "y": 2,
        "bridges": [
          {
            "x": 12,
            "y": 4,
            "mode": "off"
          },
          {
            "x": 13,
            "y": 4,
            "mode": "off"
          },
          {
            "x": 1,
            "y": 9,
            "mode": "off"
          },
          {
            "x": 2,
            "y": 9,
            "mode": "off"
          }
        ]
      },
      {
        "x": 2,
        "y": 6,
        "bridges": [
          {
            "x": 12,
            "y": 4,
            "mode": "off"
          },
          {
            "x": 13,
            "y": 4,
            "mode": "off"
          },
          {
            "x": 1,
            "y": 9,
            "mode": "off"
          },
          {
            "x": 2,
            "y": 9,
            "mode": "off"
          }
        ]
      },
      {
        "x": 3,
        "y": 9,
        "bridges": [
          {
            "x": 5,
            "y": 5,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 8,
        "y": 7,
        "bridges": [
          {
            "x": 12,
            "y": 4,
            "mode": "on"
          },
          {
            "x": 13,
            "y": 4,
            "mode": "on"
          },
          {
            "x": 1,
            "y": 9,
            "mode": "on"
          },
          {
            "x": 2,
            "y": 9,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "pb",
    "code": "119785",
    "tiles": [
      " bbbbbbbbbsbbbb",
      "     bb      bb",
      "     bb      bb",
      "             bb",
      "             bb",
      "bbb  bblrbsbbbb",
      "beb  bb        ",
      "bbb  bb        ",
      " bb  bb        ",
      " bkqbbbbbbsbbb "
    ],
    "spawn": [
      1,
      0
    ],
    "switches": [
      {
        "x": 10,
        "y": 0,
        "bridges": [
          {
            "x": 7,
            "y": 5,
            "mode": "onoff"
          },
          {
            "x": 8,
            "y": 5,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 10,
        "y": 5,
        "bridges": [
          {
            "x": 2,
            "y": 9,
            "mode": "off"
          },
          {
            "x": 3,
            "y": 9,
            "mode": "off"
          }
        ]
      },
      {
        "x": 10,
        "y": 9,
        "bridges": [
          {
            "x": 2,
            "y": 9,
            "mode": "on"
          },
          {
            "x": 3,
            "y": 9,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "tb",
    "code": "543019",
    "tiles": [
      "            bbb",
      "  bbbkqbbblrbbb",
      "  bbb  sbb  bbb",
      "  bbb  bbb     ",
      "  bsb  vbs     ",
      "  bbb  bbb     ",
      "bbbb   bbblrsbb",
      "bs          bbb",
      "            beb",
      "            bbb"
    ],
    "spawn": [
      8,
      2
    ],
    "switches": [
      {
        "x": 7,
        "y": 2,
        "bridges": [
          {
            "x": 5,
            "y": 1,
            "mode": "off"
          },
          {
            "x": 6,
            "y": 1,
            "mode": "off"
          }
        ]
      },
      {
        "x": 9,
        "y": 4,
        "bridges": [
          {
            "x": 5,
            "y": 1,
            "mode": "off"
          },
          {
            "x": 6,
            "y": 1,
            "mode": "off"
          }
        ]
      },
      {
        "x": 3,
        "y": 4,
        "bridges": [
          {
            "x": 5,
            "y": 1,
            "mode": "off"
          },
          {
            "x": 6,
            "y": 1,
            "mode": "off"
          }
        ]
      },
      {
        "x": 12,
        "y": 6,
        "bridges": [
          {
            "x": 10,
            "y": 6,
            "mode": "onoff"
          },
          {
            "x": 11,
            "y": 6,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 1,
        "y": 7,
        "bridges": [
          {
            "x": 10,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 11,
            "y": 1,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 7,
        "y": 4,
        "a": [
          13,
          1
        ],
        "b": [
          13,
          7
        ]
      }
    ]
  },
  {
    "id": "mn",
    "code": "728724",
    "tiles": [
      "        bb     ",
      "       bbb     ",
      "bb  bbbbbb     ",
      "bbbbbb  b      ",
      "bbbb    b   bbb",
      " bb     hbbbbeb",
      "  b     hb  bbb",
      "  bbbl  bb     ",
      "   bbb  bb     ",
      "   rbbbbbb     "
    ],
    "spawn": [
      1,
      3
    ],
    "switches": [
      {
        "x": 8,
        "y": 5,
        "bridges": [
          {
            "x": 3,
            "y": 9,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 8,
        "y": 6,
        "bridges": [
          {
            "x": 5,
            "y": 7,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "lh",
    "code": "987319",
    "tiles": [
      "      bb    bbb",
      "    bbbbbb  beb",
      " bbbbbbsbbbbbbb",
      " bbbbs  bbbbbl ",
      " bbb      bbb  ",
      "  b        b   ",
      "  b        b   ",
      "  bl      qb   ",
      "  bb      bb   ",
      "   h      h    "
    ],
    "spawn": [
      2,
      3
    ],
    "switches": [
      {
        "x": 10,
        "y": 9,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 3,
        "y": 9,
        "bridges": [
          {
            "x": 13,
            "y": 3,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 5,
        "y": 3,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 13,
            "y": 3,
            "mode": "off"
          }
        ]
      },
      {
        "x": 7,
        "y": 2,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 13,
            "y": 3,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "tt",
    "code": "293486",
    "tiles": [
      " bbb        bbb",
      " bhb        bsb",
      " bbb   bbbkqbbb",
      "rbbbl  beb  bbs",
      "b   b  bbb    b",
      "s   b  fff    b",
      "blrbbbfffffbbbk",
      "   bbbfffffbvb ",
      "   bbbfffffbbb ",
      "   bbbbbl      "
    ],
    "spawn": [
      4,
      7
    ],
    "switches": [
      {
        "x": 14,
        "y": 3,
        "bridges": [
          {
            "x": 14,
            "y": 6,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 11,
            "y": 2,
            "mode": "off"
          }
        ]
      },
      {
        "x": 13,
        "y": 1,
        "bridges": [
          {
            "x": 8,
            "y": 9,
            "mode": "onoff"
          },
          {
            "x": 1,
            "y": 6,
            "mode": "on"
          },
          {
            "x": 2,
            "y": 6,
            "mode": "on"
          }
        ]
      },
      {
        "x": 0,
        "y": 5,
        "bridges": [
          {
            "x": 0,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 1,
            "y": 6,
            "mode": "off"
          },
          {
            "x": 2,
            "y": 6,
            "mode": "off"
          }
        ]
      },
      {
        "x": 2,
        "y": 1,
        "bridges": [
          {
            "x": 4,
            "y": 3,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 12,
        "y": 7,
        "a": [
          12,
          7
        ],
        "b": [
          2,
          2
        ]
      }
    ]
  },
  {
    "id": "kn",
    "code": "088198",
    "tiles": [
      "               ",
      "           bbbb",
      "    rbbbbbbbhbv",
      "  blrbhb   bbbb",
      " hb  bb      b ",
      " bb  b       b ",
      " bbbbb     bbb ",
      " bbb  bbblrbeb ",
      "      hbl  bbb ",
      "               "
    ],
    "spawn": [
      2,
      3
    ],
    "switches": [
      {
        "x": 1,
        "y": 4,
        "bridges": [
          {
            "x": 4,
            "y": 2,
            "mode": "on"
          }
        ]
      },
      {
        "x": 12,
        "y": 2,
        "bridges": [
          {
            "x": 4,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 3,
            "y": 3,
            "mode": "on"
          }
        ]
      },
      {
        "x": 6,
        "y": 3,
        "bridges": [
          {
            "x": 8,
            "y": 8,
            "mode": "on"
          }
        ]
      },
      {
        "x": 6,
        "y": 8,
        "bridges": [
          {
            "x": 9,
            "y": 7,
            "mode": "on"
          },
          {
            "x": 10,
            "y": 7,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 14,
        "y": 2,
        "a": [
          6,
          7
        ],
        "b": [
          8,
          7
        ]
      }
    ]
  },
  {
    "id": "dd",
    "code": "250453",
    "tiles": [
      "  bb           ",
      "  bbb          ",
      "  bbs     bbbl ",
      "   bbbbl  bebl ",
      "      bblrbbb  ",
      " bb   bb       ",
      "bbhbkqbb       ",
      "bbk   bb   bbb ",
      "bbk   bbsbbbbb ",
      "           bbb "
    ],
    "spawn": [
      1,
      7
    ],
    "switches": [
      {
        "x": 4,
        "y": 2,
        "bridges": [
          {
            "x": 13,
            "y": 2,
            "mode": "onoff"
          },
          {
            "x": 13,
            "y": 3,
            "mode": "onoff"
          },
          {
            "x": 8,
            "y": 4,
            "mode": "onoff"
          },
          {
            "x": 9,
            "y": 4,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 8,
        "y": 8,
        "bridges": [
          {
            "x": 7,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 4,
            "y": 6,
            "mode": "off"
          },
          {
            "x": 5,
            "y": 6,
            "mode": "off"
          }
        ]
      },
      {
        "x": 2,
        "y": 6,
        "bridges": [
          {
            "x": 8,
            "y": 4,
            "mode": "on"
          },
          {
            "x": 9,
            "y": 4,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "hg",
    "code": "426329",
    "tiles": [
      "     bbbb    v ",
      "     bbsbbb  b ",
      "    bbbbbbb  b ",
      "bbkqbbbb  bbbb ",
      "bbbl  b   bb   ",
      "bbb   b   b    ",
      " b    bbb      ",
      " h    bebl     ",
      "      bbb      ",
      "               "
    ],
    "spawn": [
      10,
      5
    ],
    "switches": [
      {
        "x": 7,
        "y": 1,
        "bridges": [
          {
            "x": 2,
            "y": 3,
            "mode": "off"
          },
          {
            "x": 3,
            "y": 3,
            "mode": "off"
          }
        ]
      },
      {
        "x": 1,
        "y": 7,
        "bridges": [
          {
            "x": 9,
            "y": 7,
            "mode": "on"
          },
          {
            "x": 3,
            "y": 4,
            "mode": "on"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 13,
        "y": 0,
        "a": [
          12,
          3
        ],
        "b": [
          10,
          5
        ]
      }
    ]
  },
  {
    "id": "vh",
    "code": "660141",
    "tiles": [
      "bbb    bbbbbbbb",
      "bbbbbbbbbbb  bb",
      "bbb    bb    bb",
      "            bhb",
      "            bb ",
      "bbb  ffffb  ss ",
      "bebfffffff  bbb",
      "bbbfffffffffbbb",
      "     fffffffbbb",
      "      qbbk     "
    ],
    "spawn": [
      1,
      1
    ],
    "switches": [
      {
        "x": 12,
        "y": 5,
        "bridges": [
          {
            "x": 6,
            "y": 9,
            "mode": "off"
          }
        ]
      },
      {
        "x": 13,
        "y": 5,
        "bridges": [
          {
            "x": 9,
            "y": 9,
            "mode": "off"
          }
        ]
      },
      {
        "x": 13,
        "y": 3,
        "bridges": [
          {
            "x": 6,
            "y": 9,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 9,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "fm",
    "code": "769721",
    "tiles": [
      " bbkqbb        ",
      " bb  bbb       ",
      "ffb  bbbb      ",
      "ff     bbb     ",
      "ff      bbb    ",
      "fbbb     bbv   ",
      " beb      bbbbb",
      " bbbbbb   bsbbb",
      "  b  bb   bbb  ",
      "  b  bbbkqbbb  "
    ],
    "spawn": [
      2,
      2
    ],
    "switches": [
      {
        "x": 11,
        "y": 7,
        "bridges": [
          {
            "x": 4,
            "y": 0,
            "mode": "off"
          },
          {
            "x": 3,
            "y": 0,
            "mode": "off"
          },
          {
            "x": 8,
            "y": 9,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 9,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": [
      {
        "x": 11,
        "y": 5,
        "a": [
          14,
          6
        ],
        "b": [
          12,
          9
        ]
      }
    ]
  },
  {
    "id": "mp",
    "code": "691859",
    "tiles": [
      "  skqb   blrh  ",
      "     b   b     ",
      "     bbbbb     ",
      "hlrbbbbbbbbblrh",
      "     bbbbb     ",
      "     rb  b     ",
      "     rb  bkqs  ",
      "bbb  bb  b     ",
      "beblrb   b     ",
      "bbbl     bkqs  "
    ],
    "spawn": [
      7,
      3
    ],
    "switches": [
      {
        "x": 2,
        "y": 0,
        "bridges": [
          {
            "x": 10,
            "y": 0,
            "mode": "on"
          },
          {
            "x": 11,
            "y": 0,
            "mode": "on"
          },
          {
            "x": 10,
            "y": 6,
            "mode": "off"
          },
          {
            "x": 11,
            "y": 6,
            "mode": "off"
          }
        ]
      },
      {
        "x": 12,
        "y": 0,
        "bridges": [
          {
            "x": 5,
            "y": 5,
            "mode": "on"
          },
          {
            "x": 5,
            "y": 6,
            "mode": "on"
          }
        ]
      },
      {
        "x": 0,
        "y": 3,
        "bridges": [
          {
            "x": 3,
            "y": 8,
            "mode": "on"
          },
          {
            "x": 4,
            "y": 8,
            "mode": "on"
          },
          {
            "x": 10,
            "y": 9,
            "mode": "off"
          },
          {
            "x": 11,
            "y": 9,
            "mode": "off"
          }
        ]
      },
      {
        "x": 14,
        "y": 3,
        "bridges": [
          {
            "x": 3,
            "y": 9,
            "mode": "on"
          }
        ]
      },
      {
        "x": 12,
        "y": 6,
        "bridges": [
          {
            "x": 1,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 2,
            "y": 3,
            "mode": "on"
          }
        ]
      },
      {
        "x": 12,
        "y": 9,
        "bridges": [
          {
            "x": 12,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 13,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 10,
            "y": 6,
            "mode": "off"
          },
          {
            "x": 11,
            "y": 6,
            "mode": "off"
          },
          {
            "x": 3,
            "y": 0,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 0,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 0,
            "mode": "off"
          },
          {
            "x": 11,
            "y": 0,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "gv",
    "code": "280351",
    "tiles": [
      "   bbbbbffbbbb ",
      "   bebb     fb ",
      "   bbb      fbh",
      "       fbbkqbbb",
      "  b    ff     b",
      " hbf   ff     b",
      "ffff   bbl  rbb",
      "fffbfbffbf  hbl",
      "bfffffffffffb  ",
      " fbfff  ffffb  "
    ],
    "spawn": [
      2,
      4
    ],
    "switches": [
      {
        "x": 1,
        "y": 5,
        "bridges": [
          {
            "x": 10,
            "y": 3,
            "mode": "on"
          },
          {
            "x": 11,
            "y": 3,
            "mode": "on"
          }
        ]
      },
      {
        "x": 14,
        "y": 2,
        "bridges": [
          {
            "x": 10,
            "y": 3,
            "mode": "off"
          },
          {
            "x": 11,
            "y": 3,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 6,
            "mode": "on"
          },
          {
            "x": 12,
            "y": 6,
            "mode": "on"
          }
        ]
      },
      {
        "x": 12,
        "y": 7,
        "bridges": [
          {
            "x": 14,
            "y": 7,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "kc",
    "code": "138620",
    "tiles": [
      "           bbbl",
      " bbb    h  bebl",
      " bbbkqbbblrbbbl",
      " bbb  bbb   b  ",
      " fff  sbb   f  ",
      "  f   bbb  fff ",
      "  b   bbb  bbb ",
      "qbbblrbsbkqbbb ",
      "qbhb  h    bbb ",
      "qbbb           "
    ],
    "spawn": [
      12,
      7
    ],
    "switches": [
      {
        "x": 8,
        "y": 1,
        "bridges": [
          {
            "x": 9,
            "y": 2,
            "mode": "onoff"
          },
          {
            "x": 10,
            "y": 2,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 6,
        "y": 8,
        "bridges": [
          {
            "x": 4,
            "y": 7,
            "mode": "onoff"
          },
          {
            "x": 5,
            "y": 7,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 2,
        "y": 8,
        "bridges": [
          {
            "x": 14,
            "y": 2,
            "mode": "on"
          },
          {
            "x": 14,
            "y": 1,
            "mode": "on"
          },
          {
            "x": 14,
            "y": 0,
            "mode": "on"
          },
          {
            "x": 4,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 5,
            "y": 2,
            "mode": "off"
          }
        ]
      },
      {
        "x": 7,
        "y": 7,
        "bridges": [
          {
            "x": 4,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 5,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 5,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 6,
        "y": 4,
        "bridges": [
          {
            "x": 4,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 5,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 2,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 5,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 9,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 10,
            "y": 7,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "ed",
    "code": "879021",
    "tiles": [
      "             bh",
      "   bbkqbb   bbb",
      "  bbblrbb  bhbb",
      "  beb   bbbbb  ",
      "  bbb    bbb   ",
      "          bb   ",
      "     bbb  bb   ",
      " bblrbhb  bb   ",
      " bblrbbbbbbb   ",
      "               "
    ],
    "spawn": [
      11,
      6
    ],
    "switches": [
      {
        "x": 14,
        "y": 0,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "onoff"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "onoff"
          },
          {
            "x": 5,
            "y": 1,
            "mode": "onoff"
          },
          {
            "x": 6,
            "y": 1,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 12,
        "y": 2,
        "bridges": [
          {
            "x": 3,
            "y": 8,
            "mode": "onoff"
          },
          {
            "x": 4,
            "y": 8,
            "mode": "onoff"
          }
        ]
      },
      {
        "x": 6,
        "y": 7,
        "bridges": [
          {
            "x": 5,
            "y": 2,
            "mode": "onoff"
          },
          {
            "x": 6,
            "y": 2,
            "mode": "onoff"
          }
        ]
      }
    ],
    "splits": []
  },
  {
    "id": "ol",
    "code": "614955",
    "tiles": [
      "     bbsbbb    ",
      "     bbbbbbl   ",
      "bbb  sbbsbbbbb ",
      "bbbkqbbbbssbbs ",
      "     bbsbbsbbb ",
      "     bbbbbbsbb ",
      "bbb  bbbbbbsbbb",
      "bebkqbsb  bbbsh",
      "bbb  bbb   bbbb",
      "bbb         bbb"
    ],
    "spawn": [
      1,
      3
    ],
    "switches": [
      {
        "x": 14,
        "y": 7,
        "bridges": [
          {
            "x": 11,
            "y": 1,
            "mode": "on"
          }
        ]
      },
      {
        "x": 7,
        "y": 0,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 5,
        "y": 2,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 8,
        "y": 2,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 9,
        "y": 3,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 10,
        "y": 3,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 10,
        "y": 4,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 11,
        "y": 5,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 13,
        "y": 3,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 11,
        "y": 6,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 13,
        "y": 7,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 7,
        "y": 4,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      },
      {
        "x": 6,
        "y": 7,
        "bridges": [
          {
            "x": 3,
            "y": 7,
            "mode": "off"
          },
          {
            "x": 4,
            "y": 7,
            "mode": "off"
          }
        ]
      }
    ],
    "splits": []
  }
];

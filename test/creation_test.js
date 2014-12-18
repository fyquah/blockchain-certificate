require("./lib/parser.js").process_transaction({
    "txid": "the transaction txid",
    "vin": [
    {
        "txid": "some_previoux_txid",
        "vout": 0
    }
    ],
    "vout": [
    {
        "value": 0.0001,
        "n": 0,
        "scriptPubKey": {
            "hex": "not_relevant",
            "addresses": [
            "mqybb75AYGvNDnTTRs7xE517iBsjT9ux2J"
            ]
        }
    },
    {
        "value": 0,
        "n": 1,
        "scriptPubKey": {
            "hex": "6a27626363004357573e23561fff39594add89556564e1b1348bbd7a0088d42f67cb73eeaed59c009d"
        },
        "type": "nulldata"
    },
    {
        "value": 0.0001,
        "n": 2,
        "scriptPubKey": {
            "hex": "not_relevant",
            "addresses": [
            "mqybb75AYGvNDnTTRs7xE517iBsjT9ux2J"
            ]
        }
    }
    ]
});

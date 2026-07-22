#!/usr/bin/env python3
import unittest
from pathlib import Path
import importlib.util


ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("collect", ROOT / "collect.py")
collect = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(collect)


class CollectTests(unittest.TestCase):
    def test_extract_model_payload_uses_last_complete_findings(self):
        text = '{"findings":[]}\n{"findings":[{"creatorHandle":"KillaXBT"}],"digestSummary":["a"]}'
        payload = collect.extract_model_payload(text)
        self.assertEqual(len(payload["findings"]), 1)
        self.assertEqual(payload["findings"][0]["creatorHandle"], "KillaXBT")

    def test_validate_findings_rejects_foreign_author_and_bad_evidence(self):
        accepted, rejected = collect.validate_findings(
            {
                "findings": [
                    {
                        "creatorHandle": "KillaXBT",
                        "url": "https://x.com/KillaXBT/status/2079586556814164073",
                        "sourceText": "buy BTC below the 50D MA on the monthly",
                        "sourceTextKind": "verbatim_or_search_excerpt",
                        "publishedAt": "2026-07-21T15:17:26Z",
                        "language": "en",
                        "postType": "original",
                        "summary": "BTC wait below MA",
                        "symbols": ["BTC"],
                        "direction": "LONG",
                        "entryPrice": "虚构",
                        "entryPriceEvidence": "not-here",
                        "entryTiming": "月线低于 50D MA 时",
                        "entryTimingEvidence": "buy BTC below the 50D MA on the monthly",
                        "invalidation": "未明确",
                        "invalidationEvidence": "",
                        "strategyMatch": "UNKNOWN",
                        "strategyReason": "缺失效条件",
                    },
                    {
                        "creatorHandle": "outsider",
                        "url": "https://x.com/outsider/status/1",
                        "sourceText": "hello",
                        "sourceTextKind": "verbatim_or_search_excerpt",
                        "publishedAt": "2026-07-21T15:17:26Z",
                        "language": "en",
                        "postType": "original",
                        "summary": "x",
                        "symbols": [],
                        "direction": "NONE",
                        "entryPrice": "未明确",
                        "entryPriceEvidence": "",
                        "entryTiming": "未明确",
                        "entryTimingEvidence": "",
                        "invalidation": "未明确",
                        "invalidationEvidence": "",
                        "strategyMatch": "UNKNOWN",
                        "strategyReason": "未明确",
                    },
                ]
            },
            accounts=["KillaXBT"],
            window={"since": "2026-07-18T00:00:00Z", "until": "2026-07-22T00:00:00Z"},
        )
        self.assertEqual(len(accepted), 1)
        self.assertEqual(accepted[0]["entryPrice"], "未明确")
        self.assertEqual(accepted[0]["entryTiming"], "月线低于 50D MA 时")
        self.assertTrue(any(item["reason"] == "creator_not_allowed" for item in rejected))

    def test_sign_body_is_stable(self):
        signature = collect.sign_body("0123456789abcdef0123456789abcdef", "1710000000", '{"a":1}')
        self.assertTrue(signature.startswith("sha256="))
        self.assertEqual(len(signature), len("sha256=") + 64)


if __name__ == "__main__":
    unittest.main()

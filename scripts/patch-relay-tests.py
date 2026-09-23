from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected snippet not found in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "tests/chatgpt-web-models.test.ts",
    '      "GPT-5.6 Sol Instant (Web)", "GPT-5.6 Sol (Web)", "GPT-5.6 Pro (Web)", "GPT-6 Pro (Web)",\n',
    '      "GPT-5.6 Sol Instant (Web)", "GPT-5.6 Sol (Web)", "GPT-5.6 Pro (Web)", "GPT-6 Pro (Web)",\n'
    '      "GPT-5.6 Sol Relay (Web)",\n',
)
replace_once(
    "tests/chatgpt-web-models.test.ts",
    '      "chatgpt-web/gpt-5.6-sol",\n    ]);\n',
    '      "chatgpt-web/gpt-5.6-sol",\n      "chatgpt-web/relay",\n    ]);\n',
)
replace_once(
    "tests/chatgpt-web-models.test.ts",
    '      .toEqual(["chatgpt-web/gpt-5.6-sol-instant", "chatgpt-web/gpt-5.6-sol"]);\n',
    '      .toEqual(["chatgpt-web/gpt-5.6-sol-instant", "chatgpt-web/gpt-5.6-sol", "chatgpt-web/relay"]);\n',
)
replace_once(
    "tests/model-catalog.test.ts",
    '    expect(spawnOverrides).toEqual([\n      "gpt-5.6-sol",\n      ...CHATGPT_WEB_MODEL_ROUTES.slice(1).map(route => route.slug),\n      "chatgpt-web/gpt-5.6-sol-instant",\n    ]);\n',
    '    expect(spawnOverrides).toEqual([\n      "gpt-5.6-sol",\n      ...CHATGPT_WEB_MODEL_ROUTES.slice(1).map(route => route.slug),\n    ]);\n',
)
replace_once(
    "tests/model-catalog.test.ts",
    '    expect(web.map(model => model.slug)).toEqual([\n      "chatgpt-web/gpt-5.6-sol-instant",\n      "chatgpt-web/gpt-5.6-sol",\n      "chatgpt-web/light",\n      "chatgpt-web/medium",\n      "chatgpt-web/high",\n      "chatgpt-web/extra-high",\n    ]);\n',
    '    expect(web.map(model => model.slug)).toEqual([\n      "chatgpt-web/gpt-5.6-sol-instant",\n      "chatgpt-web/gpt-5.6-sol",\n      "chatgpt-web/light",\n      "chatgpt-web/medium",\n      "chatgpt-web/high",\n      "chatgpt-web/extra-high",\n      "chatgpt-web/relay",\n    ]);\n',
)
replace_once(
    "tests/model-catalog.test.ts",
    '    expect(web.length).toBe(5);\n',
    '    expect(web.length).toBe(6);\n',
)
replace_once(
    "tests/model-catalog.test.ts",
    '    expect(web).toHaveLength(5);\n',
    '    expect(web).toHaveLength(6);\n',
)
replace_once(
    "tests/server-models.test.ts",
    '    "chatgpt-web/pro",\n  ]);\n',
    '    "chatgpt-web/pro",\n    "chatgpt-web/relay",\n  ]);\n',
)
replace_once(
    "tests/server-models.test.ts",
    '  expect(body.models.filter(model => model.slug.startsWith("chatgpt-web/")))\n    .toHaveLength(5);\n',
    '  expect(body.models.filter(model => model.slug.startsWith("chatgpt-web/")))\n    .toHaveLength(6);\n',
)

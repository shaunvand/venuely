"""Brand the Supabase Auth email templates to match Venuely.
Run: SUPABASE_ACCESS_TOKEN=... python scripts/brand_auth_emails.py

Design: rich HTML card with a CSS-rendered Venuely logo (orange "V." tile +
wordmark — reliable because many email clients block <img> by default), the
action button, then a PLAIN-TEXT hyperlink underneath the card as a fallback
for clients that strip the rich styling.
"""
import json, os, urllib.request

REF = "njhlmucwdsmzlswjlhmf"
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
URL = f"https://api.supabase.com/v1/projects/{REF}/config/auth"

WRAPPER = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#FFF6F0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6F0;padding:32px 12px;">
<tr><td align="center">

<!-- Card -->
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #f1e7df;border-radius:16px;">
<tr><td style="padding:38px 40px 8px;text-align:center;">
<!-- Logo lockup: orange V. tile + wordmark -->
<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>
<td style="width:46px;height:46px;background:#FA523C;border-radius:12px;text-align:center;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:#FFF6F0;line-height:46px;">V.</td>
<td style="padding-left:12px;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:bold;color:#FA523C;letter-spacing:-1px;">Venuely.</td>
</tr></table>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:#9a948e;text-transform:uppercase;margin-top:12px;">Weddings Made Easy</div>
</td></tr>

<tr><td style="padding:22px 40px 0;"><div style="height:1px;background:#f1e7df;"></div></td></tr>

<tr><td style="padding:26px 40px 4px;">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#1c1917;margin:0 0 12px;font-weight:normal;">__HEADING__</h1>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#57534e;margin:0 0 26px;">__INTRO__</p>
</td></tr>

<tr><td style="padding:0 40px 30px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#FA523C;">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">__BTN__</a>
</td></tr></table></td></tr>

<tr><td style="padding:0 40px 36px;">
<div style="height:1px;background:#f1e7df;margin-bottom:16px;"></div>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9a948e;margin:0;">__NOTE__</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c4bdb4;margin:12px 0 0;">&copy; Venuely &middot; venuely.co.za</p>
</td></tr>
</table>
<!-- /Card -->

<!-- Plain-text fallback (shows even if the card styling is stripped) -->
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="padding:22px 24px 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:#57534e;">
Button not working? __FALLBACK_LEAD__:<br>
<a href="{{ .ConfirmationURL }}" style="color:#FA523C;text-decoration:underline;word-break:break-all;">{{ .ConfirmationURL }}</a>
</td></tr>
</table>

</td></tr></table>
</body></html>"""


def tpl(heading, intro, btn, note, fallback_lead):
    return (WRAPPER.replace("__HEADING__", heading).replace("__INTRO__", intro)
            .replace("__BTN__", btn).replace("__NOTE__", note)
            .replace("__FALLBACK_LEAD__", fallback_lead))


TEMPLATES = {
    "mailer_templates_confirmation_content": tpl(
        "Confirm your email",
        "Welcome to Venuely &mdash; weddings made easy. Tap the button below to verify your email address and finish setting up your venue.",
        "Confirm my email",
        "If you didn&rsquo;t sign up for Venuely, you can safely ignore this email.",
        "copy and paste this link into your browser to confirm your email address"),
    "mailer_templates_magic_link_content": tpl(
        "Your sign-in link",
        "Tap below to sign in to Venuely. This link works once and expires shortly.",
        "Sign in to Venuely",
        "If you didn&rsquo;t request this link, you can safely ignore this email.",
        "copy and paste this link into your browser to sign in"),
    "mailer_templates_recovery_content": tpl(
        "Reset your password",
        "We received a request to reset your Venuely password. Tap below to choose a new one.",
        "Reset password",
        "If you didn&rsquo;t request a reset, you can safely ignore this email &mdash; your password won&rsquo;t change.",
        "copy and paste this link into your browser to reset your password"),
    "mailer_templates_invite_content": tpl(
        "You&rsquo;re invited to Venuely",
        "You&rsquo;ve been invited to help manage a venue on Venuely. Tap below to set your password and join the team.",
        "Accept invitation",
        "If you weren&rsquo;t expecting this invitation, you can ignore this email.",
        "copy and paste this link into your browser to accept the invitation"),
    "mailer_templates_email_change_content": tpl(
        "Confirm your new email",
        "Tap below to confirm the new email address for your Venuely account.",
        "Confirm email change",
        "If you didn&rsquo;t request this change, please contact us at hello@venuely.co.za.",
        "copy and paste this link into your browser to confirm your new email"),
}


def main():
    body = json.dumps(TEMPLATES).encode()
    req = urllib.request.Request(URL, data=body, method="PATCH", headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json",
        "User-Agent": "curl/8.4", "Accept": "application/json"})
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read().decode())
    print("PATCHED templates:")
    for k in TEMPLATES:
        cur = res.get(k, "")
        ok = "Venuely." in cur and "ConfirmationURL" in cur
        print(f"  {k}: {'OK' if ok else 'CHECK'} ({len(cur)} chars)")


if __name__ == "__main__":
    main()

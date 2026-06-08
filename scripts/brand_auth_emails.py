"""Brand the Supabase Auth email templates to match Venuely.
Run: SUPABASE_ACCESS_TOKEN=... python scripts/brand_auth_emails.py
"""
import json, os, urllib.request

REF = "njhlmucwdsmzlswjlhmf"
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
URL = f"https://api.supabase.com/v1/projects/{REF}/config/auth"

WRAPPER = """<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#FFF6F0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6F0;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #f1e7df;border-radius:16px;">
<tr><td style="padding:38px 40px 6px;text-align:center;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:bold;color:#FA523C;letter-spacing:-1px;line-height:1;">Venuely.</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:#9a948e;text-transform:uppercase;margin-top:9px;">Weddings Made Easy</div>
</td></tr>
<tr><td style="padding:22px 40px 0;"><div style="height:1px;background:#f1e7df;"></div></td></tr>
<tr><td style="padding:26px 40px 4px;">
<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#1c1917;margin:0 0 12px;font-weight:normal;">__HEADING__</h1>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#57534e;margin:0 0 26px;">__INTRO__</p>
</td></tr>
<tr><td style="padding:0 40px 6px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#FA523C;">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">__BTN__</a>
</td></tr></table></td></tr>
<tr><td style="padding:22px 40px 0;">
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9a948e;margin:0 0 5px;">Or paste this link into your browser:</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;margin:0;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#FA523C;text-decoration:underline;">{{ .ConfirmationURL }}</a></p>
</td></tr>
<tr><td style="padding:24px 40px 38px;">
<div style="height:1px;background:#f1e7df;margin-bottom:16px;"></div>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9a948e;margin:0;">__NOTE__</p>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c4bdb4;margin:12px 0 0;">&copy; Venuely &middot; venuely.co.za</p>
</td></tr>
</table></td></tr></table></body></html>"""


def tpl(heading, intro, btn, note):
    return (WRAPPER.replace("__HEADING__", heading).replace("__INTRO__", intro)
            .replace("__BTN__", btn).replace("__NOTE__", note))


TEMPLATES = {
    "mailer_templates_confirmation_content": tpl(
        "Confirm your email",
        "Welcome to Venuely — weddings made easy. Tap below to verify your email and finish setting up your venue.",
        "Confirm my email",
        "If you didn&rsquo;t sign up for Venuely, you can safely ignore this email."),
    "mailer_templates_magic_link_content": tpl(
        "Your sign-in link",
        "Tap below to sign in to Venuely. This link works once and expires shortly.",
        "Sign in to Venuely",
        "If you didn&rsquo;t request this link, you can safely ignore this email."),
    "mailer_templates_recovery_content": tpl(
        "Reset your password",
        "We received a request to reset your Venuely password. Tap below to choose a new one.",
        "Reset password",
        "If you didn&rsquo;t request a reset, you can safely ignore this email &mdash; your password won&rsquo;t change."),
    "mailer_templates_invite_content": tpl(
        "You&rsquo;re invited to Venuely",
        "You&rsquo;ve been invited to help manage a venue on Venuely. Tap below to set your password and join the team.",
        "Accept invitation",
        "If you weren&rsquo;t expecting this invitation, you can ignore this email."),
    "mailer_templates_email_change_content": tpl(
        "Confirm your new email",
        "Tap below to confirm the new email address for your Venuely account.",
        "Confirm email change",
        "If you didn&rsquo;t request this change, please contact us at hello@venuely.co.za."),
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
        print(f"  {k}: {'OK' if 'Venuely.' in cur else 'CHECK'} ({len(cur)} chars)")


if __name__ == "__main__":
    main()

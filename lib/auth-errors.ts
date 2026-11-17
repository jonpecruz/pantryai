type AuthFailure = { code?: string; status?: number; message?: string };

export function signUpErrorMessage(error: AuthFailure): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Too many sign-up or confirmation-email requests. Check your inbox and spam folder for the first confirmation email. If you already confirmed it, use Sign in. Otherwise wait before trying again.";
  }
  switch (error.code) {
    case "user_already_exists":
      return "An account already exists. Use Sign in, or confirm your email first if you have not done so.";
    case "weak_password":
      return "Choose a stronger password with at least 8 characters, including letters and numbers.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "email_address_not_authorized":
    case "email_address_not_authorized_for_email_send":
      return "The email service is not configured to send confirmation emails to this address yet. The app owner needs to connect an email provider.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "New email accounts are not enabled for this app yet. The app owner needs to enable email registration.";
  }
  if (/sending.*(?:confirmation|email)|email.*(?:delivery|smtp)/i.test(error.message ?? "")) {
    return "The confirmation email could not be sent. The app owner needs to check the email delivery settings.";
  }
  return "Account creation could not finish. If you already requested an account, check your inbox and spam folder, then use Sign in. Otherwise try again shortly.";
}


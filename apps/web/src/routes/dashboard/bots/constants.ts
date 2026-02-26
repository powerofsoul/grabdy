/** Fallback value for native color picker inputs when no color is set */
export const COLOR_PICKER_FALLBACK = '#000000';

export interface CodeSnippet {
  code: string;
  language: string;
  filename: string;
}

const INTEGRATION_LANGUAGES = ['JavaScript / TypeScript', 'C#', 'WordPress'] as const;
export type IntegrationLanguage = (typeof INTEGRATION_LANGUAGES)[number];
export { INTEGRATION_LANGUAGES };

export function isIntegrationLanguage(value: string): value is IntegrationLanguage {
  const langs: readonly string[] = INTEGRATION_LANGUAGES;
  return langs.includes(value);
}

interface IntegrationGuide {
  backendInstall: CodeSnippet;
  backendCode: CodeSnippet;
  frontendInstall: CodeSnippet;
  frontendFloating: CodeSnippet;
  frontendInline: CodeSnippet;
}

export function getIntegrationGuide(lang: IntegrationLanguage, chatId: string): IntegrationGuide {
  switch (lang) {
    case 'JavaScript / TypeScript':
      return getJsGuide(chatId);
    case 'C#':
      return getCSharpGuide(chatId);
    case 'WordPress':
      return getWordPressGuide(chatId);
  }
}

function getJsGuide(chatId: string): IntegrationGuide {
  return {
    backendInstall: {
      code: `npm install jsonwebtoken express cors dotenv`,
      language: 'bash',
      filename: 'Install dependencies',
    },
    backendCode: {
      code: `import express from "express";
import jwt from "jsonwebtoken";
import fs from "fs";

const app = express();
const privateKey = fs.readFileSync("private_key.pem", "utf8");

// This endpoint should be behind your own authentication.
// Use the authenticated user's ID as the "sub" claim.
app.get("/api/grabdy/token", (req, res) => {
  const token = jwt.sign(
    {
      sub: req.user.id,       // Your authenticated user's ID
      chatId: "${chatId}",
    },
    privateKey,
    {
      algorithm: "RS256",
      expiresIn: "1h",
      keyid: "YOUR_KEY_FINGERPRINT", // From the Signing Keys tab
    }
  );
  res.json({ jwt: token });
});

app.listen(3001);`,
      language: 'typescript',
      filename: 'server.ts',
    },
    frontendInstall: {
      code: `<script src="https://sdk.grabdy.com/sdk.js"></script>`,
      language: 'html',
      filename: 'index.html',
    },
    frontendFloating: {
      code: `<script>
  const chat = new GrabdyChat({
    chatId: "${chatId}",
    getToken: async () => {
      const res = await fetch("/api/grabdy/token");
      const data = await res.json();
      return data.jwt;
    },
    // position: "bottom-left",   // default: "bottom-right"
  });
</script>`,
      language: 'html',
      filename: 'Floating button',
    },
    frontendInline: {
      code: `<div id="grabdy-chat" style="width: 400px; height: 600px;"></div>
<script>
  const chat = new GrabdyChat({
    chatId: "${chatId}",
    getToken: async () => {
      const res = await fetch("/api/grabdy/token");
      const data = await res.json();
      return data.jwt;
    },
    container: "#grabdy-chat",
  });
</script>`,
      language: 'html',
      filename: 'Inline container',
    },
  };
}

function getCSharpGuide(chatId: string): IntegrationGuide {
  return {
    backendInstall: {
      code: `dotnet add package System.IdentityModel.Tokens.Jwt`,
      language: 'bash',
      filename: 'Install dependency',
    },
    backendCode: {
      code: `using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

public class GrabdyTokenService
{
    private readonly RSA _rsa;

    public GrabdyTokenService(string privateKeyPem)
    {
        _rsa = RSA.Create();
        _rsa.ImportFromPem(privateKeyPem);
    }

    public string GenerateJwt(string userId, string keyFingerprint)
    {
        var key = new RsaSecurityKey(_rsa)
        {
            KeyId = keyFingerprint // From the Signing Keys tab
        };
        var credentials = new SigningCredentials(
            key,
            SecurityAlgorithms.RsaSha256
        );

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId),
            new Claim("chatId", "${chatId}"),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// In your controller:
[Authorize]
[HttpGet("/api/grabdy/token")]
public IActionResult GetToken()
{
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var jwt = _tokenService.GenerateJwt(userId);
    return Ok(new { jwt });
}`,
      language: 'csharp',
      filename: 'GrabdyTokenService.cs',
    },
    frontendInstall: {
      code: `<script src="https://sdk.grabdy.com/sdk.js"></script>`,
      language: 'html',
      filename: 'index.html or _Layout.cshtml',
    },
    frontendFloating: {
      code: `<script>
  const chat = new GrabdyChat({
    chatId: "${chatId}",
    getToken: async () => {
      const res = await fetch("/api/grabdy/token");
      const data = await res.json();
      return data.jwt;
    },
  });
</script>`,
      language: 'html',
      filename: 'Floating button',
    },
    frontendInline: {
      code: `<div id="grabdy-chat" style="width: 400px; height: 600px;"></div>
<script>
  const chat = new GrabdyChat({
    chatId: "${chatId}",
    getToken: async () => {
      const res = await fetch("/api/grabdy/token");
      const data = await res.json();
      return data.jwt;
    },
    container: "#grabdy-chat",
  });
</script>`,
      language: 'html',
      filename: 'Inline container',
    },
  };
}

function getWordPressGuide(chatId: string): IntegrationGuide {
  return {
    backendInstall: {
      code: `composer require firebase/php-jwt`,
      language: 'bash',
      filename: 'Install in your theme or plugin directory',
    },
    backendCode: {
      code: `// In your theme's functions.php or a custom plugin:
require_once __DIR__ . "/vendor/autoload.php";

use Firebase\\JWT\\JWT;

function grabdy_chat_jwt(): string {
    $private_key = file_get_contents(ABSPATH . "private_key.pem");
    $user = wp_get_current_user();

    $key_fingerprint = "YOUR_KEY_FINGERPRINT"; // From the Signing Keys tab

    return JWT::encode([
        "sub" => (string) $user->ID,
        "chatId" => "${chatId}",
        "iat" => time(),
        "exp" => time() + 3600,
    ], $private_key, "RS256", $key_fingerprint);
}

// Register a REST endpoint for the SDK to call:
add_action("rest_api_init", function () {
    register_rest_route("grabdy/v1", "/token", [
        "methods" => "GET",
        "callback" => function () {
            if (!is_user_logged_in()) {
                return new WP_Error("unauthorized", "Not logged in", ["status" => 401]);
            }
            return ["jwt" => grabdy_chat_jwt()];
        },
        "permission_callback" => "is_user_logged_in",
    ]);
});`,
      language: 'php',
      filename: 'functions.php',
    },
    frontendInstall: {
      code: `// Enqueue the SDK script in your theme:
add_action("wp_enqueue_scripts", function () {
    wp_enqueue_script(
        "grabdy-sdk",
        "https://sdk.grabdy.com/sdk.js",
        [],
        null,
        true
    );
});`,
      language: 'php',
      filename: 'functions.php',
    },
    frontendFloating: {
      code: `// Add the widget initialization to your theme footer:
add_action("wp_footer", function () {
    if (!is_user_logged_in()) return;
    ?>
    <script>
      const chat = new GrabdyChat({
        chatId: "<?php echo esc_attr("${chatId}"); ?>",
        getToken: async () => {
          const res = await fetch("/wp-json/grabdy/v1/token");
          const data = await res.json();
          return data.jwt;
        },
      });
    </script>
    <?php
});`,
      language: 'php',
      filename: 'Floating button (functions.php)',
    },
    frontendInline: {
      code: `// Use a shortcode to place the chat anywhere:
add_shortcode("grabdy_chat", function () {
    if (!is_user_logged_in()) return "";
    return '<div id="grabdy-chat" style="width:100%;height:600px"></div>
    <script>
      new GrabdyChat({
        chatId: "<?php echo esc_attr("${chatId}"); ?>",
        getToken: async () => {
          const res = await fetch("/wp-json/grabdy/v1/token");
          const data = await res.json();
          return data.jwt;
        },
        container: "#grabdy-chat",
      });
    </script>';
});

// Usage in any page or post: [grabdy_chat]`,
      language: 'php',
      filename: 'Inline shortcode (functions.php)',
    },
  };
}

export function getConfigReference(): CodeSnippet {
  return {
    code: `const chat = new GrabdyChat({
  // Required
  chatId: string,                    // Your SDK Chat ID
  getToken: () => Promise<string>,   // Async function that returns a JWT

  // Optional
  container: string,    // CSS selector to mount inline (e.g. "#chat")
                        // If omitted, shows a floating button
  bubble: boolean,      // Show floating bubble button (default: true)
                        // Set to false to open programmatically via chat.open()
  position: string,     // "bottom-right" (default) or "bottom-left"
  zIndex: number,       // z-index for the widget (default: 999999)
});

// Appearance (title, colors, logo, placeholder) is configured
// in the Settings tab and applied automatically.

// Methods:
chat.open();            // Open the chat widget
chat.close();           // Close the chat widget
chat.refreshToken();    // Force a token refresh (calls getToken again)
chat.destroy();         // Remove widget and clean up`,
    language: 'javascript',
    filename: 'Options and Methods',
  };
}

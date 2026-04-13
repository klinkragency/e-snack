package email

const verificationTemplate = `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background: #000; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
		.content { background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px; }
		.code { font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f7f7f7; border-radius: 8px; margin: 20px 0; color: #000; }
		.footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
		.warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>e-Snack</h1>
		</div>
		<div class="content">
			<p>Bonjour,</p>
			<p>Pour vérifier votre adresse email, utilisez le code suivant :</p>
			<div class="code">%s</div>
			<p>Ce code est valide pendant <strong>10 minutes</strong>.</p>
			<div class="warning">
				<strong>Sécurité</strong><br>
				Ne partagez jamais ce code avec qui que ce soit.
			</div>
		</div>
		<div class="footer">
			<p>Votre plateforme de commande en ligne</p>
			<p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
		</div>
	</div>
</body>
</html>`

const passwordResetTemplate = `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background: #000; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
		.content { background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px; }
		.code { font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f7f7f7; border-radius: 8px; margin: 20px 0; color: #000; }
		.footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
		.warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px; }
		.alert { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin-top: 20px; border-radius: 4px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>e-Snack</h1>
		</div>
		<div class="content">
			<p>Bonjour,</p>
			<p>Vous avez demandé à réinitialiser votre mot de passe. Voici votre code :</p>
			<div class="code">%s</div>
			<p>Ce code est valide pendant <strong>30 minutes</strong>.</p>
			<div class="warning">
				<strong>Sécurité</strong><br>
				Ne partagez jamais ce code.
			</div>
			<div class="alert">
				<strong>Important</strong><br>
				Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
			</div>
		</div>
		<div class="footer">
			<p>Votre plateforme de commande en ligne</p>
		</div>
	</div>
</body>
</html>`


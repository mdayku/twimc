test:
	cd server && npx tsx test_schema.test.js && npx tsx test_pii.test.js && npx tsx test_docx.test.js && npx tsx test_fallback_template.test.js

test-integration:
	cd server && npx tsx test_e2e.test.js && npx tsx test_error_handling.test.js && npx tsx test_provider_integration.test.js

test-all:
	just test
	just test-integration

typecheck:
	cd server && tsc --noEmit

lint:
	echo "No linting tools configured"

ghost:
	echo "No unused export analysis tools configured"

schema:
	echo "No database schema tools configured"

ship:
	just typecheck
	just test
	just lint
	just ghost
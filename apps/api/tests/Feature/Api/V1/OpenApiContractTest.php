<?php

namespace Tests\Feature\Api\V1;

use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

class OpenApiContractTest extends TestCase
{
    /** @var list<string> */
    private const EXPECTED_OPERATION_IDS = [
        'login',
        'logout',
        'me',
        'getScript',
        'getSyncChanges',
        'submitSyncCommands',
        'startScriptCueGeneration',
        'startCardCueGeneration',
        'getAiGeneration',
    ];

    public function test_every_implemented_api_route_has_its_canonical_operation_id(): void
    {
        $document = $this->document();
        $operationIds = [];

        foreach ($document['paths'] as $pathItem) {
            foreach ($pathItem as $operation) {
                if (is_array($operation) && isset($operation['operationId'])) {
                    $operationIds[] = $operation['operationId'];
                }
            }
        }

        $this->assertEqualsCanonicalizing(self::EXPECTED_OPERATION_IDS, $operationIds);

        $implementedRoutes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn (LaravelRoute $route): bool => str_starts_with($route->uri(), 'api/v1/'))
            ->flatMap(function (LaravelRoute $route): array {
                return collect($route->methods())
                    ->reject(fn (string $method): bool => in_array($method, ['HEAD', 'OPTIONS'], true))
                    ->mapWithKeys(fn (string $method): array => [
                        strtolower($method).' /'.$route->uri() => true,
                    ])->all();
            });

        foreach ($implementedRoutes as $routeKey => $_) {
            [$method, $path] = explode(' ', $routeKey, 2);
            $this->assertArrayHasKey($path, $document['paths'], "OpenAPI path missing for {$routeKey}");
            $this->assertArrayHasKey($method, $document['paths'][$path], "OpenAPI operation missing for {$routeKey}");
            $this->assertNotEmpty($document['paths'][$path][$method]['operationId'] ?? null);
        }
    }

    #[DataProvider('responseExamples')]
    public function test_representative_response_examples_match_their_schemas(
        string $path,
        string $method,
        string $status,
    ): void {
        $document = $this->document();
        $response = $document['paths'][$path][$method]['responses'][$status];
        $mediaType = $response['content']['application/json'];

        $this->assertMatchesSchema($mediaType['example'], $mediaType['schema'], $document, '$');
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function responseExamples(): iterable
    {
        yield 'login' => ['/api/v1/auth/login', 'post', '200'];
        yield 'me' => ['/api/v1/me', 'get', '200'];
        yield 'script' => ['/api/v1/scripts/{script}', 'get', '200'];
    }

    public function test_sync_snapshot_relationship_ids_are_part_of_the_transport_contract(): void
    {
        $schemas = $this->document()['components']['schemas'];

        $this->assertContains('script_id', $schemas['CardSnapshot']['required']);
        $this->assertSame('uuid', $schemas['CardSnapshot']['properties']['script_id']['format']);
        $this->assertContains('card_id', $schemas['CueSetSnapshot']['required']);
        $this->assertSame('uuid', $schemas['CueSetSnapshot']['properties']['card_id']['format']);
        $this->assertSame(200, $schemas['CueSetSnapshot']['properties']['cues']['items']['maxLength']);
    }

    /** @return array<string, mixed> */
    private function document(): array
    {
        $path = base_path('../../docs/api/openapi.yaml');
        $this->assertFileExists($path);

        $document = Yaml::parseFile($path);
        $this->assertIsArray($document);
        $this->assertMatchesRegularExpression('/^3\./', $document['openapi'] ?? '');

        return $document;
    }

    /**
     * @param  array<string, mixed>  $schema
     * @param  array<string, mixed>  $document
     */
    private function assertMatchesSchema(mixed $value, array $schema, array $document, string $path): void
    {
        if (isset($schema['$ref'])) {
            $schema = $this->resolveReference($schema['$ref'], $document);
        }

        if ($value === null && ($schema['nullable'] ?? false) === true) {
            return;
        }

        if (isset($schema['enum'])) {
            $this->assertContains($value, $schema['enum'], "Unexpected enum value at {$path}");
        }

        $type = $schema['type'] ?? null;
        if ($type === 'object') {
            $this->assertIsArray($value, "Expected object at {$path}");
            foreach ($schema['required'] ?? [] as $required) {
                $this->assertArrayHasKey($required, $value, "Missing required property {$path}.{$required}");
            }
            foreach ($value as $name => $child) {
                $this->assertArrayHasKey($name, $schema['properties'] ?? [], "Undocumented property {$path}.{$name}");
                $this->assertMatchesSchema($child, $schema['properties'][$name], $document, "{$path}.{$name}");
            }

            return;
        }

        if ($type === 'array') {
            $this->assertIsArray($value, "Expected array at {$path}");
            foreach ($value as $index => $child) {
                $this->assertMatchesSchema($child, $schema['items'], $document, "{$path}[{$index}]");
            }

            return;
        }

        match ($type) {
            'string' => $this->assertIsString($value, "Expected string at {$path}"),
            'integer' => $this->assertIsInt($value, "Expected integer at {$path}"),
            'boolean' => $this->assertIsBool($value, "Expected boolean at {$path}"),
            default => $this->fail("Unsupported or missing schema type at {$path}"),
        };
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, mixed>
     */
    private function resolveReference(string $reference, array $document): array
    {
        $this->assertStringStartsWith('#/', $reference);
        $value = $document;

        foreach (explode('/', substr($reference, 2)) as $segment) {
            $this->assertArrayHasKey($segment, $value, "Missing OpenAPI reference {$reference}");
            $value = $value[$segment];
        }

        $this->assertIsArray($value);

        return $value;
    }
}

"""Tests for flavor_service.py — Worker API client."""
import json
import pytest
from unittest.mock import patch, MagicMock

from src.flavor_service import (
    clean_text,
    fetch_flavors_from_api,
    fetch_and_cache,
    load_cache,
    get_primary_location,
    get_backup_location,
)


MOCK_API_RESPONSE = {
    'name': 'Mt. Horeb',
    'flavors': [
        {'date': '2026-02-20', 'title': 'Dark Chocolate PB Crunch', 'description': 'Dark Chocolate custard.'},
        {'date': '2026-02-21', 'title': 'Chocolate Caramel Twist', 'description': 'Chocolate and Vanilla.'},
    ],
}


class TestCleanText:
    def test_removes_trademark_symbols(self):
        assert clean_text('OREO\u00ae Cookies') == 'OREO Cookies'

    def test_removes_tm_symbol(self):
        assert clean_text('Turtle\u2122') == 'Turtle'

    def test_collapses_extra_spaces(self):
        assert clean_text('Mint   Explosion') == 'Mint Explosion'

    def test_passthrough_clean_text(self):
        assert clean_text('Butter Pecan') == 'Butter Pecan'


class TestFetchFlavorsFromApi:
    @patch('src.flavor_service.requests.get')
    def test_returns_mapped_flavors(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = MOCK_API_RESPONSE
        mock_get.return_value = mock_resp

        result = fetch_flavors_from_api('mt-horeb', 'http://test-worker')
        assert len(result) == 2
        assert result[0]['name'] == 'Dark Chocolate PB Crunch'
        assert result[0]['date'] == '2026-02-20'

    @patch('src.flavor_service.requests.get')
    def test_maps_title_to_name(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            'name': 'Test',
            'flavors': [{'date': '2026-02-20', 'title': 'Butter Pecan\u00ae', 'description': ''}],
        }
        mock_get.return_value = mock_resp

        result = fetch_flavors_from_api('test', 'http://test-worker')
        assert result[0]['name'] == 'Butter Pecan'

    @patch('src.flavor_service.requests.get')
    def test_calls_versioned_api(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {'name': 'Test', 'flavors': []}
        mock_get.return_value = mock_resp

        fetch_flavors_from_api('mt-horeb', 'http://test-worker')
        mock_get.assert_called_with(
            'http://test-worker/api/v1/flavors?slug=mt-horeb',
            timeout=15,
        )

    @patch('src.flavor_service.requests.get')
    def test_retries_on_failure(self, mock_get):
        import requests as req
        mock_get.side_effect = [
            req.ConnectionError('Connection error'),
            MagicMock(
                raise_for_status=MagicMock(),
                json=MagicMock(return_value={'name': 'Test', 'flavors': []}),
            ),
        ]

        result = fetch_flavors_from_api('mt-horeb', 'http://test-worker')
        assert result == []
        assert mock_get.call_count == 2


class TestFetchAndCache:
    @patch('src.flavor_service.fetch_flavors_from_api')
    def test_new_config_format(self, mock_fetch, tmp_path):
        mock_fetch.return_value = [
            {'date': '2026-02-20', 'name': 'Test Flavor', 'description': ''},
        ]

        config = {
            'worker_base': 'http://test-worker',
            'stores': [
                {'slug': 'mt-horeb', 'brand': 'culvers', 'name': 'Mt. Horeb', 'role': 'primary'},
            ],
        }

        cache_path = str(tmp_path / 'cache.json')
        result = fetch_and_cache(config, cache_path)

        assert 'mt-horeb' in result['locations']
        assert result['locations']['mt-horeb']['brand'] == 'culvers'
        assert result['locations']['mt-horeb']['role'] == 'primary'
        assert len(result['locations']['mt-horeb']['flavors']) == 1

    @patch('src.flavor_service.fetch_flavors_from_api')
    def test_old_config_backward_compat(self, mock_fetch, tmp_path):
        mock_fetch.return_value = [
            {'date': '2026-02-20', 'name': 'Test', 'description': ''},
        ]

        config = {
            'culvers': {
                'locations': [
                    {
                        'name': 'Mt. Horeb',
                        'url': 'https://www.culvers.com/restaurants/mt-horeb',
                        'role': 'primary',
                        'enabled': True,
                    },
                ],
            },
        }

        cache_path = str(tmp_path / 'cache.json')
        result = fetch_and_cache(config, cache_path)

        assert 'mt-horeb' in result['locations']
        mock_fetch.assert_called_once()


class TestCacheIO:
    def test_load_cache(self, tmp_path):
        cache_path = str(tmp_path / 'cache.json')
        data = {'version': 2, 'locations': {'test': {'role': 'primary'}}}
        with open(cache_path, 'w') as f:
            json.dump(data, f)

        loaded = load_cache(cache_path)
        assert loaded['version'] == 2

    def test_load_cache_missing_file(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_cache(str(tmp_path / 'nonexistent.json'))


class TestLocationHelpers:
    def test_get_primary_location(self):
        cache = {'locations': {
            'a': {'role': 'secondary'},
            'b': {'role': 'primary', 'name': 'Mt. Horeb'},
        }}
        assert get_primary_location(cache)['name'] == 'Mt. Horeb'

    def test_get_primary_returns_none(self):
        assert get_primary_location({'locations': {}}) is None

    def test_get_backup_location(self):
        cache = {'locations': {
            'a': {'role': 'primary'},
            'b': {'role': 'secondary', 'name': 'Madison'},
        }}
        assert get_backup_location(cache)['name'] == 'Madison'

    def test_get_backup_legacy_role(self):
        cache = {'locations': {
            'a': {'role': 'backup', 'name': 'Madison'},
        }}
        assert get_backup_location(cache)['name'] == 'Madison'

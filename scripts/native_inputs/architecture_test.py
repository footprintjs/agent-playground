"""Derive sealed Python script libraries and check external imports."""
import ast
from pathlib import Path
import tempfile
import unittest


def private_imports(scripts):
    libraries = [(path, path.relative_to(scripts).as_posix().replace('/', '.'))
                 for path in scripts.rglob('*') if path.is_dir() and
                 path.with_suffix('.py').is_file() and
                 (path / '__init__.py').is_file()]
    violations = []
    for caller in scripts.rglob('*.py'):
        for library, module in libraries:
            if caller.is_relative_to(library) or caller == library.with_suffix('.py'):
                continue
            for node in ast.walk(ast.parse(caller.read_text(), filename=str(caller))):
                names = []
                if isinstance(node, ast.ImportFrom):
                    prefix = list(caller.relative_to(scripts).parts[:-1])
                    prefix = prefix[:len(prefix) - node.level + 1] if node.level else []
                    name = '.'.join(prefix + [node.module or '']).strip('.')
                    names = [name]
                    if name == module:
                        names += [module + '.' + alias.name for alias in node.names
                                  if (library / (alias.name + '.py')).is_file()]
                elif isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                if any(name.startswith(module + '.') for name in names):
                    violations.append(f'{caller.relative_to(scripts)}:{node.lineno}')
    return violations


class ScriptBoundaryTests(unittest.TestCase):
    def test_external_callers_use_the_sealed_library_entry(self):
        self.assertEqual(private_imports(Path(__file__).resolve().parents[1]), [])

    def test_nested_libraries_refuse_static_private_imports_and_allow_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            scripts = Path(directory)
            library = scripts / 'tools' / 'sample'
            library.mkdir(parents=True)
            (library / '__init__.py').write_text('')
            (library / 'private.py').write_text('')
            (library / 'inside.py').write_text('from tools.sample.private import value')
            library.with_suffix('.py').write_text('from tools.sample.private import value')
            caller = scripts / 'tools' / 'caller.py'
            for statement in ['from tools.sample.private import value',
                              'import tools.sample.private',
                              'from .sample.private import value',
                              'from tools.sample import private']:
                caller.write_text(statement)
                with self.subTest(statement=statement):
                    self.assertEqual(private_imports(scripts), ['tools/caller.py:1'])
            caller.write_text('from tools.sample import value\n'
                              '# from tools.sample.private import value\n'
                              'text = "import tools.sample.private"\n')
            self.assertEqual(private_imports(scripts), [])

#!/usr/bin/env python3
"""
Day4 同步工具 - 将本地文件增量同步到 GitHub 仓库
使用 GitHub REST API 将文件推送为单个提交

使用方法:
    python sync_day4.py --help
    python sync_day4.py --dry-run     # 预演，不实际提交
    python sync_day4.py --push        # 实际推送
"""

import os
import sys
import json
import argparse
import hashlib
from pathlib import Path
from typing import Optional

try:
    from github import Github, GithubException
except ImportError:
    print("❌ 需要 PyGithub 库。请执行:")
    print("   pip install PyGithub")
    sys.exit(1)


# Day4 必须同步的文件清单
REQUIRED_FILES = [
    # 生产链路和依赖注入
    "backend/main.py",
    "backend/services/chat_service.py",
    "backend/services/memory_service.py",
    "backend/services/mock_demo_service.py",
    "backend/agents/master_agent.py",
    "backend/agents/memory_agent.py",
    "backend/agents/reflection_agent.py",
    "backend/agents/planning_agent.py",
    "backend/core/composition_root.py",
    "backend/core/database.py",
    "backend/core/llm_service.py",
    "backend/core/settings.py",
    "backend/core/providers/qwen_provider.py",
    "backend/tools/sql_tool.py",
    "backend/tools/vector_search_tool.py",
    "backend/schemas/chat_schema.py",
    # Prompt、协议和数据库
    "backend/prompts/planning_prompt.md",
    "backend/prompts/reflection_prompt.md",
    "backend/prompts/intent_classification_prompt.md",
    "backend/prompts/interaction_prompt.md",
    "backend/prompts/life_understanding_prompt.md",
    "backend/database_schema.md",
    "backend/migrations/001_initial_memory_schema.sql",
    "backend/requirements.txt",
    "backend/.env.example",
    "backend/.gitignore",
    "pytest.ini",
    # 测试和验收脚本
    "backend/tests/test_api_chat.py",
    "backend/tests/test_chat_service.py",
    "backend/tests/test_core_agent_flow.py",
    "backend/tests/test_llm_provider.py",
    "backend/tests/test_intent_prompt.py",
    "backend/tests/test_llm_retry.py",
    "backend/tests/test_master_agent_routing.py",
    "backend/tests/test_memory_agent.py",
    "backend/tests/test_planning_agent.py",
    "backend/tests/test_production_wiring.py",
    "backend/tests/test_reflection_agent.py",
    "backend/tests/test_sql_tool.py",
    "backend/tests/test_vector_search_tool.py",
    "backend/tests/manual_agent_flow.py",
    "backend/tests/manual_day2_memory_flow.py",
    "backend/tests/manual_day4_planning_acceptance.py",
]

# 禁止上传的文件（安全列表）
FORBIDDEN_FILES = [
    "backend/.env",
    ".env",
    ".env.local",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".pyc",
]


def check_file_forbidden(filepath: str) -> bool:
    """检查文件是否在禁止列表中"""
    for pattern in FORBIDDEN_FILES:
        if pattern in filepath:
            return True
    return False


def load_file_content(filepath: str) -> Optional[str]:
    """读取文件内容"""
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"❌ 读取文件失败: {filepath}")
        print(f"   错误: {e}")
        return None


def get_file_sha(repo, filepath: str) -> Optional[str]:
    """获取远程文件的 SHA（用于更新时使用）"""
    try:
        content = repo.get_contents(filepath)
        return content.sha
    except GithubException as e:
        if e.status == 404:
            return None  # 文件不存在
        raise


def sync_files_to_github(
    repo_owner: str,
    repo_name: str,
    github_token: str,
    files: list,
    branch: str = "main",
    dry_run: bool = True,
    commit_message: str = "feat(day4): integrate production memory and planning workflow"
) -> dict:
    """
    同步文件到 GitHub 仓库
    
    Returns:
        {
            "success": bool,
            "commit_sha": str or None,
            "files_synced": int,
            "files_skipped": int,
            "errors": list
        }
    """
    try:
        g = Github(github_token)
        repo = g.get_repo(f"{repo_owner}/{repo_name}")
        print(f"✓ 连接到仓库: {repo_owner}/{repo_name}")
    except GithubException as e:
        return {
            "success": False,
            "commit_sha": None,
            "files_synced": 0,
            "files_skipped": 0,
            "errors": [f"仓库连接失败: {e}"]
        }

    files_to_commit = {}
    errors = []
    skipped = 0

    print("\n" + "="*60)
    print("文件同步清单")
    print("="*60)

    for filepath in files:
        if check_file_forbidden(filepath):
            print(f"⊘ [跳过] {filepath} (禁止上传)")
            skipped += 1
            continue

        content = load_file_content(filepath)
        if content is None:
            print(f"✗ [缺失] {filepath}")
            errors.append(f"本地文件不存在: {filepath}")
            skipped += 1
            continue

        # 检查远程是否已存在此文件，获取其 SHA
        remote_sha = get_file_sha(repo, filepath)
        
        files_to_commit[filepath] = {
            "message": f"Update {filepath}",
            "content": content,
            "sha": remote_sha  # 如果是新文件，SHA 为 None；否则为现有 SHA
        }
        
        status = "[新增]" if remote_sha is None else "[更新]"
        print(f"✓ {status} {filepath}")

    print(f"\n总计: {len(files_to_commit)} 个文件待提交，{skipped} 个跳过")

    if not files_to_commit:
        print("\n❌ 没有文件可提交")
        return {
            "success": False,
            "commit_sha": None,
            "files_synced": 0,
            "files_skipped": skipped,
            "errors": errors or ["没有要提交的文件"]
        }

    if dry_run:
        print("\n" + "="*60)
        print("🔄 [模拟运行] 不实际提交")
        print("="*60)
        return {
            "success": True,
            "commit_sha": None,
            "files_synced": len(files_to_commit),
            "files_skipped": skipped,
            "errors": errors,
            "message": "模拟运行完成，可用 --push 执行实际提交"
        }

    # 实际提交
    print("\n" + "="*60)
    print("正在提交...")
    print("="*60)

    try:
        # GitHub REST API v3 创建或更新多个文件需要分别调用
        # 为了创建单个提交，我们需要使用 tree API
        # 这里使用简化方案：逐个上传文件（仍为同一时间戳）
        
        master_branch = repo.get_branch(branch)
        base_tree = repo.get_git_tree(master_branch.commit.sha)
        
        # 构建新 tree
        new_tree_elements = []
        for filepath, file_info in files_to_commit.items():
            blob = repo.create_git_blob(file_info["content"], "utf-8")
            new_tree_elements.append(
                InputGitTreeElement(
                    path=filepath,
                    mode="100644",
                    type="blob",
                    sha=blob.sha
                )
            )
        
        # 创建 tree
        new_tree = repo.create_git_tree(new_tree_elements, base_tree)
        
        # 创建 commit
        commit = repo.create_git_commit(
            message=commit_message,
            tree=new_tree,
            parents=[repo.get_git_commit(master_branch.commit.sha)]
        )
        
        # 更新分支引用
        repo.get_git_ref(f"heads/{branch}").edit(commit.sha)
        
        print(f"✓ 提交成功!")
        print(f"  提交 SHA: {commit.sha}")
        print(f"  提交信息: {commit_message}")
        
        return {
            "success": True,
            "commit_sha": commit.sha,
            "files_synced": len(files_to_commit),
            "files_skipped": skipped,
            "errors": errors
        }
        
    except Exception as e:
        error_msg = f"提交失败: {str(e)}"
        print(f"❌ {error_msg}")
        errors.append(error_msg)
        return {
            "success": False,
            "commit_sha": None,
            "files_synced": 0,
            "files_skipped": skipped,
            "errors": errors
        }


def main():
    parser = argparse.ArgumentParser(
        description="Day4 增量同步工具"
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="实际推送到 GitHub（不添加此标志会进行模拟运行）"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="模拟运行，不推送（默认行为）"
    )
    parser.add_argument(
        "--token",
        type=str,
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub Personal Access Token（默认从 GITHUB_TOKEN 环境变量读取）"
    )
    parser.add_argument(
        "--owner",
        type=str,
        default="Universe0121",
        help="仓库所有者"
    )
    parser.add_argument(
        "--repo",
        type=str,
        default="LifeSteward",
        help="仓库名称"
    )
    parser.add_argument(
        "--branch",
        type=str,
        default="main",
        help="目标分支"
    )
    
    args = parser.parse_args()

    if not args.token:
        print("❌ GitHub Token 未找到")
        print("请设置环境变量: export GITHUB_TOKEN=your_token")
        print("或使用参数: --token <your_token>")
        sys.exit(1)

    dry_run = args.dry_run or not args.push

    result = sync_files_to_github(
        repo_owner=args.owner,
        repo_name=args.repo,
        github_token=args.token,
        files=REQUIRED_FILES,
        branch=args.branch,
        dry_run=dry_run,
        commit_message="feat(day4): integrate production memory and planning workflow"
    )

    print("\n" + "="*60)
    print("同步结果")
    print("="*60)
    print(f"成功: {'✓ 是' if result['success'] else '✗ 否'}")
    print(f"提交 SHA: {result['commit_sha'] or 'N/A'}")
    print(f"已同步文件: {result['files_synced']}")
    print(f"跳过文件: {result['files_skipped']}")
    
    if result['errors']:
        print(f"\n错误列表:")
        for error in result['errors']:
            print(f"  • {error}")
    
    if result.get('message'):
        print(f"\n{result['message']}")

    return 0 if result['success'] else 1


if __name__ == "__main__":
    sys.exit(main())

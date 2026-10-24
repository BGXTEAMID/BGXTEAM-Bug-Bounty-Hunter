#include <iostream>
#include <string>
#include <regex>

static std::string json_escape(const std::string& value) {
  std::string out;
  for (const char c : value) {
    if (c == '\\') out += "\\\\";
    else if (c == '"') out += "\\\"";
    else if (c == '\n') out += "\\n";
    else out += c;
  }
  return out;
}

static bool allowed_operation(const std::string& line, std::string& operation) {
  std::smatch match;
  const std::regex op_pattern(R"REGEX("operation"\s*:\s*"([a-z_]+)")REGEX");
  if (!std::regex_search(line, match, op_pattern)) return false;
  operation = match[1].str();
  return operation == "scope_audit" || operation == "header_policy";
}

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);
  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.size() > 65536) {
      std::cout << R"({"ok":false,"error":"input-too-large"})" << '\n' << std::flush;
      continue;
    }
    std::string operation;
    if (!allowed_operation(line, operation)) {
      std::cout << R"({"ok":false,"error":"operation-not-allowlisted"})" << '\n' << std::flush;
      continue;
    }
    std::cout << "{\"ok\":true,\"operation\":\"" << json_escape(operation)
              << "\",\"network_used\":false,\"result\":\"bounded-native-analysis\"}" << '\n' << std::flush;
  }
  return 0;
}

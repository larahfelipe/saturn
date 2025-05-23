package util

import (
	"fmt"
	"io"
	"os"
	"reflect"
	"regexp"

	"github.com/larahfelipe/saturn/internal/common"
)

// PrintObject logs the given object in the terminal.
func PrintObject(obj interface{}) {
	valueOfObj := reflect.ValueOf(obj)

	if valueOfObj.Kind() != reflect.Struct {
		fmt.Println(common.ErrInvalidPrintDataType)
		return
	}

	for i := 0; i < valueOfObj.NumField(); i++ {
		field := valueOfObj.Type().Field(i)
		fieldValue := valueOfObj.Field(i).Interface()
		fmt.Printf("%s: %v\n", field.Name, fieldValue)
	}
}

// GetFileExtFromMime extracts the file format/extension from the given mime type.
func GetFileExtFromMime(mimeType string) string {
	re := regexp.MustCompile(`\/([^;\s]+)`)
	sm := re.FindStringSubmatch(mimeType)
	if len(sm) < 1 {
		return ""
	}

	return sm[1]
}

// MkDir creates a directory based on given name.
func MkDir(name string) error {
	if err := os.MkdirAll(name, 0755); err != nil {
		return err
	}

	return nil
}

// DeleteDir deletes a directory by the given path.
func DeleteDir(dirPath string) error {
	if _, err := os.Stat(dirPath); err != nil {
		return err
	}

	if err := os.RemoveAll(dirPath); err != nil {
		return err
	}

	return nil
}

// DeleteFile deletes a file by the given path.
func DeleteFile(filePath string) error {
	if _, err := os.Stat(filePath); err != nil {
		return err
	}

	if err := os.Remove(filePath); err != nil {
		return err
	}

	return nil
}

// WriteFile creates a new file based on a readable and a file name.
func WriteFile(readable io.ReadCloser, fileName string) error {
	file, err := os.Create(fileName)
	if err != nil {
		return err
	}
	defer file.Close()

	if _, err := io.Copy(file, readable); err != nil {
		return err
	}

	return nil
}
